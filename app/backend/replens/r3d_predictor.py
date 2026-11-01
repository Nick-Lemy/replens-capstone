import hashlib
from pathlib import Path

import cv2
import numpy as np
import torch
from torch import nn
from torch.nn import functional as F
from torchvision.models.video import r3d_18

from .cropping import input_crop
from .legacy_predictor import ROOT, TemporalRegressor


class MotionAdapter(nn.Module):
    def __init__(self, rank, hidden_size):
        super().__init__()
        self.down = nn.Conv3d(512, rank, 1, bias=False)
        self.up = nn.Conv3d(rank, 512, 3, padding=1, bias=False)
        self.head = TemporalRegressor("tcn", hidden_size)

    def tokens(self, activations, base):
        return F.relu(base + self.up(F.relu(self.down(activations)))).mean((2,3,4))


def prepare_motion_frame(frame):
    height,width=frame.shape[:2]
    scale=112/max(height,width)
    image=cv2.resize(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB),(max(1,round(width*scale)),max(1,round(height*scale))))
    canvas=np.empty((112,112,3),np.uint8);canvas[:]=[110,101,96]
    y,x=(112-image.shape[0])//2,(112-image.shape[1])//2
    canvas[y:y+image.shape[0],x:x+image.shape[1]]=image
    value=torch.from_numpy(canvas).permute(2,0,1).float()/255
    return (value-torch.tensor([.43216,.394666,.37645])[:,None,None])/torch.tensor([.22803,.22145,.216989])[:,None,None]


class R3DPredictor:
    def __init__(self, bundle):
        self.metadata=bundle["metadata"]
        if self.metadata.get("preprocessing")!="native_frames_rgb_aspect_pad112_kinetics_norm_v1":
            raise RuntimeError("Unsupported motion model preprocessing.")
        weights=ROOT/"training/models/torch/checkpoints/r3d_18-b3b3357e.pth"
        if hashlib.sha256(weights.read_bytes()).hexdigest()!=self.metadata["encoder_weights_sha256"]:
            raise RuntimeError("Video encoder weights do not match the motion model.")
        self.backbone=r3d_18(weights=None)
        self.backbone.load_state_dict(torch.load(weights,map_location="cpu",weights_only=True))
        self.backbone.eval().requires_grad_(False)
        self.adapter=MotionAdapter(self.metadata["adapter_rank"],self.metadata["hidden_size"])
        self.adapter.load_state_dict(bundle["state_dict"])
        self.adapter.eval().requires_grad_(False)

    def encode(self,chunks):
        tokens=[]
        with torch.inference_mode():
            for offset in range(0,len(chunks),8):
                x=torch.stack(chunks[offset:offset+8])
                for layer in [self.backbone.stem,self.backbone.layer1,self.backbone.layer2,self.backbone.layer3,self.backbone.layer4[0]]:
                    x=layer(x)
                block=self.backbone.layer4[1];a=block.conv1(x);base=block.conv2(a)+x
                tokens.append(self.adapter.tokens(a.half().float(),base.half().float()))
        return torch.cat(tokens)

    def predict(self,path: Path,reps,progress,cancelled):
        metadata={**self.metadata,"min_prediction_rep":4}
        if len(reps)<4:
            return [None]*len(reps),metadata
        digest=hashlib.sha256(path.read_bytes()).hexdigest()
        rect,framing=input_crop(path,ROOT,digest,progress,cancelled)
        metadata.update(input_framing=framing,crop_rect=rect)
        capture=cv2.VideoCapture(str(path))
        times=[]
        try:
            while capture.grab():
                if cancelled():
                    raise ValueError("Analysis cancelled.")
                times.append(capture.get(cv2.CAP_PROP_POS_MSEC)/1000)
            times=np.asarray(times)
            if len(times)<2 or not np.isfinite(times).all() or not (np.diff(times)>0).all():
                raise ValueError("Unsupported video frame timing.")
            rep_tokens=[]
            x1,y1,x2,y2=rect
            for i,rep in enumerate(reps):
                first=int(np.searchsorted(times,rep["start_s"],"left"))
                stop=int(np.searchsorted(times,rep["end_s"],"right"))
                if stop<=first:
                    raise ValueError("No readable frames for a detected rep.")
                capture.set(cv2.CAP_PROP_POS_FRAMES,first)
                chunks=[];pending=[]
                for index in range(first,stop):
                    if cancelled():
                        raise ValueError("Analysis cancelled.")
                    ok,frame=capture.read()
                    if not ok:
                        raise ValueError("A detected repetition extends beyond the video.")
                    if abs(capture.get(cv2.CAP_PROP_POS_MSEC)/1000-times[index])>.003:
                        raise ValueError("Video frame timing changed while decoding.")
                    pending.append(prepare_motion_frame(frame[y1:y2,x1:x2]))
                    if len(pending)==16:
                        chunks.append(torch.stack(pending).permute(1,0,2,3));pending=[]
                if pending:
                    pending += [pending[-1]]*(16-len(pending))
                    chunks.append(torch.stack(pending).permute(1,0,2,3))
                rep_tokens.append(self.encode(chunks))
                progress(63+int((i+1)/len(reps)*32),"Estimating reps remaining")
        finally:
            capture.release()
        predictions=[None]*3
        with torch.inference_mode():
            for i in range(3,len(reps)):
                values=torch.cat(rep_tokens[max(0,i-3):i+1])
                prediction=float(self.adapter.head(values[None],torch.tensor([len(values)]))[0])
                predictions.append(prediction if np.isfinite(prediction) else None)
        return predictions,metadata
