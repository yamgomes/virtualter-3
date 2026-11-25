import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-homephysio',
  firestore: { rules: readFileSync('firestore.rules', 'utf8') },
});
const results = (db, patient = 'patient') =>
  collection(db, 'professionals', 'owner', 'patients', patient, 'results');
const id = (suffix) => `00000000-0000-4000-8000-00000000000${suffix}`;
try {
  const owner = env
    .authenticatedContext('owner', { email_verified: true })
    .firestore();
  const stranger = env
    .authenticatedContext('stranger', { email_verified: true })
    .firestore();
  const player = env.unauthenticatedContext().firestore();
  const access = (db, token) => doc(db, 'patientAccess', token);
  const patientId = 'walking-patient';
  const patient = doc(owner, 'professionals', 'owner', 'patients', patientId);
  const therapy = {
    gameId: 'walking',
    title: 'Caminhada',
    intensity: 'custom',
    metrics: ['activeMs', 'kneeHeight', 'balance'],
    targets: '',
    durationSeconds: 60,
    repetitions: 6,
    holdSeconds: 0.7,
    targetSeconds: 6,
    tolerancePercent: 12,
    postureTolerancePercent: 20,
    pointsPerHit: 10,
    side: 'left',
  };
  await assertSucceeds(
    setDoc(patient, {
      name: 'Paciente fictício',
      code: '',
      therapy: null,
      revision: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  const walkingCode = 'HHHHHH';
  const prescription = writeBatch(owner);
  prescription.set(doc(owner, 'issuedPatientCodes', walkingCode), {
    ownerId: 'owner',
    patientId,
  });
  prescription.set(access(owner, walkingCode), {
    ownerId: 'owner',
    patientId,
    therapy,
    revision: 1,
  });
  prescription.update(patient, {
    code: walkingCode,
    therapy,
    revision: 1,
    updatedAt: serverTimestamp(),
  });
  await assertSucceeds(prescription.commit());
  assert.deepEqual(
    (await assertSucceeds(getDoc(access(player, walkingCode)))).data().therapy,
    therapy
  );

  const base = {
    schemaVersion: 1,
    revision: 2,
    completedAtMs: Date.now(),
    activeMs: 20000,
    pausedMs: 1000,
    endReason: 'completed',
    hits: 4,
    misses: 2,
    points: 40,
    movement: { shoulderRepetitions: { left: 5, right: 4 } },
  };

  const record = async (gameId, title, accessCode, suffix, metrics = {}) => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(access(context.firestore(), accessCode), {
        ownerId: 'owner',
        patientId: 'patient',
        revision: 2,
        therapy: { gameId, title, repetitions: 6, pointsPerHit: 10 },
      });
    });
    const report = { ...base, gameId, title, accessCode, ...metrics };
    const path = doc(results(player), id(suffix));
    await assertSucceeds(setDoc(path, report));
    await assertSucceeds(setDoc(path, report));
    await assertFails(setDoc(path, { ...report, pausedMs: 0 }));
    await assertFails(deleteDoc(path));
    await assertFails(getDoc(path));
    return report;
  };

  await record('shoulder', 'Semáforo', 'CCCCCC', 1);
  const goalie = await record('goalkeeper', 'Goleiro', 'BBBBBB', 2);
  const lowerBody = { kneeHeight: { left: 95, right: 85 }, balance: 90 };
  const juggling = await record('kneeJuggle', 'Embaixadinha', 'DDDDDD', 4, {
    movement: { lowerBody },
  });
  await record('kneeRaise', 'Levantamento', 'EEEEEE', 5, {
    misses: 0,
    movement: { lowerBody },
  });
  const walking = await record('walking', 'Caminhada', 'FFFFFF', 6, {
    hits: 0,
    misses: 0,
    points: 0,
    movement: { lowerBody: { ...lowerBody, balance: null } },
  });
  const surfing = await record('surfing', 'Surfe', 'JJJJJJ', 8, {
    movement: null,
  });
  const invalid = doc(results(player), id(7));
  await assertFails(setDoc(invalid, { ...surfing, movement: base.movement }));
  await assertFails(setDoc(invalid, { ...goalie, movement: null }));
  await assertFails(setDoc(invalid, { ...juggling, movement: base.movement }));
  await assertFails(
    setDoc(invalid, {
      ...juggling,
      movement: { lowerBody: { ...lowerBody, balance: 101 } },
    })
  );
  await assertFails(setDoc(invalid, { ...walking, hits: 1, points: 10 }));
  await assertFails(
    setDoc(doc(results(player, 'another-patient'), id(3)), goalie)
  );
  await assertFails(
    setDoc(
      doc(player, 'professionals/stranger/patients/patient/results', id(3)),
      goalie
    )
  );
  await assertFails(
    setDoc(doc(results(player), id(3)), { ...goalie, revision: 1 })
  );
  await assertFails(
    setDoc(doc(results(player), id(3)), { ...goalie, points: 1000 })
  );
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(access(context.firestore(), 'BBBBBB'), { revoked: true });
  });
  await assertFails(setDoc(doc(results(player), id(3)), goalie));
  await assertFails(getDocs(query(results(stranger), limit(100))));
  await assertFails(getDoc(doc(results(stranger), id(2))));
  await assertFails(getDocs(query(results(player), limit(100))));
  const history = await assertSucceeds(
    getDocs(query(results(owner), orderBy('completedAtMs', 'desc'), limit(100)))
  );
  assert.equal(history.size, 6);
  assert.deepEqual(
    history.docs.find((doc) => doc.id === id(2)).data().movement
      .shoulderRepetitions,
    { left: 5, right: 4 }
  );
  console.log(
    'PASS placares, métricas de movimento, reenvio, acesso e leitura do histórico'
  );
} finally {
  await env.cleanup();
}
