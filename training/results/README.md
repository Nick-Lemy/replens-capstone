# Packaged research results

These are saved outputs of the completed experiments, not synthetic examples. Prediction files contain coded participant/video identifiers, repetition targets and held-out predictions. Raw recordings and review images are not included.

Notebooks 03–08 read these files when local `training/artifacts/` runs are unavailable. They can display and recompute results without raw videos. Notebook 01/02 and retraining from video still require the approved private recordings.

The selected signal run also includes `deployment_features.csv`: the seven input features, targets and coded identifiers for its 33 accepted examples. `python -m training.model_export` can refit the app's portable JSON model from these derived features using the saved inner-fold regularization choices. This refit does not create a new independent test score.

Keep the exploratory status and small-sample limitations when using these results. Dataset sizes and protocols differ between population video tests, personal calibration, near-failure classification and shaking comparisons; do not rank their error values together.

`relative_speed_followup/` contains matched nested participant-validation results, per-set curves, tracking exclusions and separately labelled training-fit diagnostics. Relative-speed and nonlinear variants did not improve overall held-out MAE. First-three-rep references passed tracking checks for only two people. The deployed model is unchanged.
