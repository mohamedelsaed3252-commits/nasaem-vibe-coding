type CameraCapabilities = MediaTrackCapabilities & {
  focusMode?: string[];
  exposureMode?: string[];
};

type CameraConstraint = MediaTrackConstraintSet & {
  focusMode?: string;
  exposureMode?: string;
};

function capabilities(track: MediaStreamTrack): CameraCapabilities {
  try {
    return track.getCapabilities?.() ?? {};
  } catch {
    return {};
  }
}

export function canFocusCamera(track: MediaStreamTrack): boolean {
  return capabilities(track).focusMode?.some(mode => mode === 'continuous' || mode === 'single-shot') ?? false;
}

// Optional camera enhancements must never prevent barcode scanning.
export async function improveCameraFocus(track: MediaStreamTrack, refocus = false): Promise<boolean> {
  const caps = capabilities(track);
  const modes = caps.focusMode ?? [];
  const focusMode = refocus && modes.includes('single-shot') ? 'single-shot'
    : modes.includes('continuous') ? 'continuous'
    : modes.includes('single-shot') ? 'single-shot' : undefined;
  const constraints: CameraConstraint[] = [];
  if (focusMode) constraints.push({ focusMode });
  if (caps.exposureMode?.includes('continuous')) constraints.push({ exposureMode: 'continuous' });
  let focused = false;
  for (const constraint of constraints) {
    if (track.readyState === 'ended') break;
    try {
      await track.applyConstraints({ advanced: [constraint] });
      if (constraint.focusMode) focused = true;
    } catch {
      // Some phones advertise controls they cannot actually apply.
    }
  }
  return focused;
}

