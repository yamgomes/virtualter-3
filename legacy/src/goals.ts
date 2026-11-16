// Goals are given as a pair of angles, one for each arm.
// Each half can be from 45 to 180, in 45 degree intervals.
export type Goal = { leftArm: number; rightArm: number };

// Function to create a pair of goals. They can't both be 180 at the same time.
export function createGoal(): Goal {
  const angles = [45, 90, 135, 180];
  let leftArm = angles[Math.floor(Math.random() * angles.length)];
  let rightArm = angles[Math.floor(Math.random() * angles.length)];
  while (leftArm === 180 && rightArm === 180) {
    rightArm = angles[Math.floor(Math.random() * angles.length)];
  }
  return { leftArm, rightArm };
}
