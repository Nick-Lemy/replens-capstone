import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { ModelChoice } from "../lib/types";

export function useAnalysisJob() {
  const [model, setModel] = useState<ModelChoice>("speed_shaking");
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const generation = useRef(0);

  const job = useQuery({
    queryKey: ["analysis", jobId],
    queryFn: () => api.job(jobId!),
    enabled: !!jobId,
    retry: 1,
    refetchInterval: (query) =>
      ["completed", "failed", "cancelled"].includes(
        query.state.data?.state ?? "",
      )
        ? false
        : 1000,
  });

  const upload = useMutation({
    mutationFn: ({
      file,
      model,
    }: {
      file: File;
      model: ModelChoice;
      generation: number;
    }) => api.analyze(file, model),
    onSuccess: (data, request) => {
      if (request.generation === generation.current) setJobId(data.id);
    },
  });

  const cancel = useMutation({
    mutationFn: ({ id }: { id: string; generation: number }) => api.cancel(id),
    onSuccess: (_, request) => {
      if (request.generation === generation.current) {
        setJobId(null);
        upload.reset();
      }
    },
  });

  const busy =
    upload.isPending ||
    (!!jobId &&
      !["completed", "failed", "cancelled"].includes(job.data?.state ?? "") &&
      !job.isError);

  function reset() {
    generation.current++;
    setJobId(null);
    upload.reset();
    cancel.reset();
  }

  function choose(value: File | null) {
    reset();
    setFile(value);
  }

  function start() {
    if (file) {
      generation.current++;
      setJobId(null);
      upload.mutate({ file, model, generation: generation.current });
    }
  }

  function cancelJob() {
    if (jobId) cancel.mutate({ id: jobId, generation: generation.current });
  }

  return {
    file,
    model,
    setModel,
    jobId,
    job,
    busy,
    upload,
    cancel,
    reset,
    choose,
    start,
    cancelJob,
  };
}
