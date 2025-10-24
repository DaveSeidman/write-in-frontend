/**
 * Central configuration for projector/display settings
 * Used by Python script, Results page, and any other components that need display dimensions
 */

export const PROJECTOR_CONFIG = {
  // Target projector resolution
  WIDTH: 1920,
  HEIGHT: 1080,

  // Calculated aspect ratio
  get ASPECT_RATIO() {
    return this.WIDTH / this.HEIGHT;
  }
};

export default PROJECTOR_CONFIG;
