import * as THREE from "three";

export interface CharacterConfig {
  headRadius: number;
  jointRadius: number;
  boneRadius: number;
  scale: {
    x: number;
    y: number;
    z: number;
  };
  colors: {
    head: number;
    arms: number;
    torso: number;
    legs: number;
    hands: number;
    feet: number;
    bones: number;
  };
}

export interface BoneConnection {
  start: number;
  end: number;
}

export class Character {
  public spheres: THREE.Mesh[] = [];
  public bones: THREE.Mesh[] = [];
  public wristBalls: { left: THREE.Mesh; right: THREE.Mesh } | null = null;
  private scene: THREE.Scene;
  private config: CharacterConfig;
  private position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private group: THREE.Group;

  // Define which landmarks get spheres (excluding face landmarks 1-10)
  private readonly sphereLandmarks = [
    0,  // nose (head)
    11, 12, // shoulders
    13, 14, // elbows
    15, 16, // wrists
    17, 18, 19, 20, 21, 22, // hands
    23, 24, // hips
    25, 26, // knees
    27, 28, // ankles
    29, 30, 31, 32 // feet
  ];

  // Define bone connections between landmarks
  private readonly boneConnections: BoneConnection[] = [
    // Torso
    { start: 11, end: 12 }, // Shoulders
    { start: 11, end: 23 }, // Left shoulder to hip
    { start: 12, end: 24 }, // Right shoulder to hip
    { start: 23, end: 24 }, // Hips

    // Arms
    { start: 11, end: 13 }, { start: 13, end: 15 }, // Left arm
    { start: 12, end: 14 }, { start: 14, end: 16 }, // Right arm

    // Hands
    { start: 15, end: 17 }, { start: 15, end: 19 }, { start: 15, end: 21 }, // Left hand
    { start: 16, end: 18 }, { start: 16, end: 20 }, { start: 16, end: 22 }, // Right hand
    { start: 17, end: 19 }, { start: 19, end: 21 }, // Left hand connections
    { start: 18, end: 20 }, { start: 20, end: 22 }, // Right hand connections

    // Legs
    { start: 23, end: 25 }, { start: 25, end: 27 }, { start: 27, end: 29 }, { start: 27, end: 31 }, // Left leg
    { start: 24, end: 26 }, { start: 26, end: 28 }, { start: 28, end: 30 }, { start: 28, end: 32 }, // Right leg
  ];

  constructor(scene: THREE.Scene, config?: Partial<CharacterConfig>) {
    this.scene = scene;
    this.config = this.mergeConfig(config);

    // Create a group to handle positioning of the entire character
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.createSpheres();
    this.createBones();
    this.createWristBalls();
  }

  private mergeConfig(userConfig?: Partial<CharacterConfig>): CharacterConfig {
    const defaultConfig: CharacterConfig = {
      headRadius: .6,
      jointRadius: 0.05,
      boneRadius: 0.01,
      scale: { x: 8, y: 6, z: 2 },
      colors: {
        head: 0xff6b6b,   // Red
        arms: 0x4ecdc4,   // Teal
        torso: 0x45b7d1,  // Blue
        legs: 0x96ceb4,   // Green
        hands: 0xfeca57,  // Yellow
        feet: 0xff9ff3,   // Pink
        bones: 0xffffff   // White
      }
    };

    return { ...defaultConfig, ...userConfig };
  }

  private createSpheres(): void {
    const sphereGeometry = new THREE.SphereGeometry(this.config.jointRadius, 16, 16);
    const headGeometry = new THREE.SphereGeometry(this.config.headRadius, 16, 16);

    // Create materials
    const materials = {
      head: new THREE.MeshBasicMaterial({ color: this.config.colors.head }),
      arms: new THREE.MeshBasicMaterial({ color: this.config.colors.arms }),
      torso: new THREE.MeshBasicMaterial({ color: this.config.colors.torso }),
      legs: new THREE.MeshBasicMaterial({ color: this.config.colors.legs }),
      hands: new THREE.MeshBasicMaterial({ color: this.config.colors.hands }),
      feet: new THREE.MeshBasicMaterial({ color: this.config.colors.feet })
    };

    // Create sphere for each landmark that should be visible
    for (let i = 0; i < 33; i++) {
      if (this.sphereLandmarks.includes(i)) {
        const material = this.getMaterialForLandmark(i, materials);
        const geometry = i === 0 ? headGeometry : sphereGeometry;

        const sphere = new THREE.Mesh(geometry, material);
        sphere.visible = false;
        this.spheres[i] = sphere;
        this.group.add(sphere);
      }
    }
  }

  private getMaterialForLandmark(landmarkIndex: number, materials: any) {
    if (landmarkIndex === 0) return materials.head; // Head
    if (landmarkIndex >= 11 && landmarkIndex <= 16) return materials.arms; // Shoulders, elbows, wrists
    if (landmarkIndex >= 17 && landmarkIndex <= 22) return materials.hands; // Hand landmarks
    if (landmarkIndex >= 23 && landmarkIndex <= 24) return materials.torso; // Hips
    if (landmarkIndex >= 25 && landmarkIndex <= 28) return materials.legs; // Knees and ankles
    if (landmarkIndex >= 29 && landmarkIndex <= 32) return materials.feet; // Feet landmarks
    return materials.torso; // Default
  }

  private createBones(): void {
    const boneGeometry = new THREE.CylinderGeometry(this.config.boneRadius, this.config.boneRadius, 1, 8);
    const boneMaterial = new THREE.MeshBasicMaterial({
      color: this.config.colors.bones,
      opacity: 0.7,
      transparent: true
    });

    this.boneConnections.forEach(() => {
      const bone = new THREE.Mesh(boneGeometry, boneMaterial);
      bone.visible = false;
      this.bones.push(bone);
      this.group.add(bone);
    });
  }

  private createWristBalls(): void {
    const ballRadius = 0.15; // Slightly larger than regular joint spheres
    const ballGeometry = new THREE.SphereGeometry(ballRadius, 16, 16);

    // Create materials with colors matching the goal system
    const leftMaterial = new THREE.MeshBasicMaterial({ color: 0xff4757 }); // Red for left wrist
    const rightMaterial = new THREE.MeshBasicMaterial({ color: 0x3742fa }); // Blue for right wrist

    // Create the wrist balls
    const leftBall = new THREE.Mesh(ballGeometry, leftMaterial);
    const rightBall = new THREE.Mesh(ballGeometry, rightMaterial);

    // Initially hide them
    leftBall.visible = false;
    rightBall.visible = false;

    // Add to group
    this.group.add(leftBall);
    this.group.add(rightBall);

    this.wristBalls = { left: leftBall, right: rightBall };
  }

  public updatePose(landmarks: any[]): void {
    this.updateSpherePositions(landmarks);
    this.updateBonePositions(landmarks);
    this.updateWristBalls(landmarks);
  }

  private updateSpherePositions(landmarks: any[]): void {
    landmarks.forEach((landmark, index) => {
      if (this.spheres[index]) {
        const worldPos = this.landmarkToWorldPosition(landmark);
        this.spheres[index].position.copy(worldPos);
      }
    });
  }

  private updateBonePositions(landmarks: any[]): void {
    this.boneConnections.forEach((connection, boneIndex) => {
      if (boneIndex < this.bones.length &&
        connection.start < landmarks.length &&
        connection.end < landmarks.length) {

        const startLandmark = landmarks[connection.start];
        const endLandmark = landmarks[connection.end];

        const startPos = this.landmarkToWorldPosition(startLandmark);
        const endPos = this.landmarkToWorldPosition(endLandmark);

        // Position bone at midpoint
        const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
        this.bones[boneIndex].position.copy(midPoint);

        // Calculate direction vector
        const direction = new THREE.Vector3().subVectors(endPos, startPos);
        const distance = direction.length();

        // Scale bone to distance between points
        this.bones[boneIndex].scale.y = distance;

        // Reset rotation before applying new orientation
        this.bones[boneIndex].rotation.set(0, 0, 0);

        // Align bone with direction vector
        // Cylinder's default orientation is along Y-axis, so we need to align Y-axis with direction
        if (distance > 0) {
          direction.normalize();

          // Create a quaternion that rotates from Y-axis to the direction vector
          const up = new THREE.Vector3(0, 1, 0);
          const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
          this.bones[boneIndex].setRotationFromQuaternion(quaternion);
        }
      }
    });
  }

  private updateWristBalls(landmarks: any[]): void {
    if (!this.wristBalls || landmarks.length < 17) return;

    // Update left wrist ball position (landmark 15)
    const leftWrist = landmarks[15];
    if (leftWrist) {
      const leftPos = this.landmarkToWorldPosition(leftWrist);
      this.wristBalls.left.position.copy(leftPos);
    }

    // Update right wrist ball position (landmark 16)
    const rightWrist = landmarks[16];
    if (rightWrist) {
      const rightPos = this.landmarkToWorldPosition(rightWrist);
      this.wristBalls.right.position.copy(rightPos);
    }
  }

  private landmarkToWorldPosition(landmark: any): THREE.Vector3 {
    return new THREE.Vector3(
      (landmark.x - 0.5) * this.config.scale.x + this.position.x,
      -(landmark.y - 0.5) * this.config.scale.y + this.position.y,
      (landmark.z ? landmark.z * this.config.scale.z : 0) + this.position.z
    );
  }

  public show(position?: THREE.Vector3 | { x: number; y: number; z: number }): void {
    // Set position if provided
    if (position) {
      if (position instanceof THREE.Vector3) {
        this.setPositionFromVector(position);
      } else {
        this.setPosition(position.x, position.y, position.z);
      }
    }

    this.spheres.forEach(sphere => {
      if (sphere) sphere.visible = true;
    });
    this.bones.forEach(bone => {
      bone.visible = true;
    });

    // Show wrist balls
    if (this.wristBalls) {
      this.wristBalls.left.visible = true;
      this.wristBalls.right.visible = true;
    }
  }

  public hide(): void {
    this.spheres.forEach(sphere => {
      if (sphere) sphere.visible = false;
    });
    this.bones.forEach(bone => {
      bone.visible = false;
    });

    // Hide wrist balls
    if (this.wristBalls) {
      this.wristBalls.left.visible = false;
      this.wristBalls.right.visible = false;
    }
  }

  public setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    this.group.position.copy(this.position);
  }

  public setPositionFromVector(position: THREE.Vector3): void {
    this.position.copy(position);
    this.group.position.copy(this.position);
  }

  public getPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  public getGroup(): THREE.Group {
    return this.group;
  }

  public dispose(): void {
    // Clean up geometry and materials
    this.spheres.forEach(sphere => {
      if (sphere) {
        this.group.remove(sphere);
        sphere.geometry.dispose();
        if (Array.isArray(sphere.material)) {
          sphere.material.forEach(mat => mat.dispose());
        } else {
          sphere.material.dispose();
        }
      }
    });

    this.bones.forEach(bone => {
      this.group.remove(bone);
      bone.geometry.dispose();
      if (Array.isArray(bone.material)) {
        bone.material.forEach(mat => mat.dispose());
      } else {
        bone.material.dispose();
      }
    });

    // Clean up wrist balls
    if (this.wristBalls) {
      this.group.remove(this.wristBalls.left);
      this.group.remove(this.wristBalls.right);

      this.wristBalls.left.geometry.dispose();
      this.wristBalls.right.geometry.dispose();

      if (Array.isArray(this.wristBalls.left.material)) {
        this.wristBalls.left.material.forEach(mat => mat.dispose());
      } else {
        this.wristBalls.left.material.dispose();
      }

      if (Array.isArray(this.wristBalls.right.material)) {
        this.wristBalls.right.material.forEach(mat => mat.dispose());
      } else {
        this.wristBalls.right.material.dispose();
      }

      this.wristBalls = null;
    }

    // Remove the group from scene
    this.scene.remove(this.group);

    this.spheres = [];
    this.bones = [];
  }
}