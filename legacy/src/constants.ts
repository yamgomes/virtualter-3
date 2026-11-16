// Constantes do jogo
export const GAME_CONFIG = {
  HEADER_HEIGHT: 60,
  TPOSE_REQUIRED_TIME: 500, // Reduced from 1000ms to 500ms
  TPOSE_DETECTION_THRESHOLDS: {
    Y_TOLERANCE: 0.15, // Increased from 0.08 to be more lenient
    X_MIN_DISTANCE: 0.15 // Decreased from 0.2 to be more accessible
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