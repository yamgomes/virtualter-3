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
  setDoc,
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

  const record = async (gameId, title, accessCode, suffix) => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(access(context.firestore(), accessCode), {
        ownerId: 'owner',
        patientId: 'patient',
        revision: 2,
        therapy: { gameId, title, repetitions: 6, pointsPerHit: 10 },
      });
    });
    const report = { ...base, gameId, title, accessCode };
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
  assert.equal(history.size, 2);
  assert.deepEqual(
    history.docs.find((doc) => doc.id === id(2)).data().movement
      .shoulderRepetitions,
    { left: 5, right: 4 }
  );
  console.log(
    'PASS placar e elevações dos dois jogos, reenvio, acesso e leitura do histórico'
  );
} finally {
  await env.cleanup();
}
