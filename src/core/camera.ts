/**
 * camera.ts — spherical orbit-camera helpers for the 3D volume (pure math).
 *
 *   C = T + r · [ cosφ·cosθ , sinφ , cosφ·sinθ ]
 *
 * where T is the target, r the orbit radius, θ azimuth, φ elevation. The
 * Volume3DView wires pointer drag → (θ, φ), wheel → r, and re-derives C here.
 */

import { Vec3 } from './geometry3d';

export type CameraPreset = 'iso' | 'front' | 'top' | 'side' | 'follow';

export interface SphericalCamera {
  target: Vec3;
  radius: number;
  azimuth: number; // θ
  elevation: number; // φ
}

const HALF_PI = Math.PI / 2;
const EL_LIMIT = HALF_PI - 0.001; // avoid gimbal lock at the poles

export function clampElevation(phi: number): number {
  return Math.max(-EL_LIMIT, Math.min(EL_LIMIT, phi));
}

/** World-space camera position for a spherical camera. */
export function cameraPosition(cam: SphericalCamera): Vec3 {
  const { target, radius: r, azimuth: th, elevation: ph } = cam;
  return [
    target[0] + r * Math.cos(ph) * Math.cos(th),
    target[1] + r * Math.sin(ph),
    target[2] + r * Math.cos(ph) * Math.sin(th),
  ];
}

interface PresetAngles {
  azimuth: number;
  elevation: number;
}

const PRESET_ANGLES: Record<CameraPreset, PresetAngles> = {
  iso: { azimuth: Math.PI * 0.25, elevation: Math.PI * 0.18 },
  front: { azimuth: HALF_PI, elevation: 0 }, // look along α at the (x,t) wall
  top: { azimuth: HALF_PI, elevation: EL_LIMIT }, // look down t at the (x,α) plane
  side: { azimuth: 0, elevation: 0 }, // look along x at the (t,α) wall
  follow: { azimuth: Math.PI * 0.28, elevation: Math.PI * 0.14 },
};

/** Build a spherical camera for a named preset. */
export function presetCamera(preset: CameraPreset, target: Vec3, radius: number): SphericalCamera {
  const a = PRESET_ANGLES[preset] ?? PRESET_ANGLES.iso;
  return {
    target,
    radius,
    azimuth: a.azimuth,
    elevation: clampElevation(a.elevation),
  };
}

/** A camera is valid if all numbers are finite, radius > 0, elevation in range. */
export function isValidCamera(cam: SphericalCamera): boolean {
  const finite =
    cam.target.every(Number.isFinite) &&
    Number.isFinite(cam.radius) &&
    Number.isFinite(cam.azimuth) &&
    Number.isFinite(cam.elevation);
  return finite && cam.radius > 0 && Math.abs(cam.elevation) <= HALF_PI;
}

export const ALL_PRESETS: CameraPreset[] = ['iso', 'front', 'top', 'side', 'follow'];
