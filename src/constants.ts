// Constantes do jogo
export const GAME_CONFIG = {
  HEADER_HEIGHT: 60,
  TPOSE_REQUIRED_TIME: 5000, // ms
  TPOSE_DETECTION_THRESHOLDS: {
    Y_TOLERANCE: 0.08,
    X_MIN_DISTANCE: 0.2
  },
  HAND_POSITION_SCALE: {
    X: 8,
    Y: 5,
    X_OFFSET: 0.5,
    Y_OFFSET: 0.6
  }
} as const;

export const UI_STYLES = {
  OVERLAY_Z_INDEX: "200",
  HEADER_Z_INDEX: "300",
  CANVAS_Z_INDEX: "1"
} as const;