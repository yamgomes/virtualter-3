import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-homephysio',
  firestore: { rules: readFileSync('firestore.rules', 'utf8') },
});
try {
  const professional = env
    .authenticatedContext('owner', { email_verified: true })
    .firestore();
  const stranger = env
    .authenticatedContext('other', { email_verified: true })
    .firestore();
  const player = env.unauthenticatedContext().firestore();
  const patient = (db) => doc(db, 'professionals/owner/patients/patient');
  const access = (db, code) => doc(db, 'patientAccess', code);
  const reservation = (db, code) => doc(db, 'issuedPatientCodes', code);
  const first = 'C'.repeat(6),
    second = 'B'.repeat(6);
  const legacy = 'DEF789';
  await assertFails(getDoc(access(professional, first)));
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(access(context.firestore(), legacy), { revoked: true });
  });
  const therapy = {
    gameId: 'shoulder',
    title: 'Semáforo',
    intensity: 'custom',
    metrics: ['hits'],
    targets: '50/50,80/50',
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
    setDoc(patient(professional), {
      name: 'Paciente fictício',
      code: '',
      therapy: null,
      revision: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  const publish = (db, ownerId, code, { old, reserve = true } = {}) =>
    runTransaction(db, async (tx) => {
      const ref = doc(db, 'professionals', ownerId, 'patients', 'patient');
      const revision = (await tx.get(ref)).data().revision + 1;
      if (reserve)
        tx.set(reservation(db, code), { ownerId, patientId: 'patient' });
      if (old) tx.set(access(db, old), { revoked: true });
      tx.set(access(db, code), {
        ownerId,
        patientId: 'patient',
        revision,
        therapy,
      });
      tx.update(ref, { code, revision, therapy, updatedAt: serverTimestamp() });
    });
  const ownerPublishes = (code, options) =>
    publish(professional, 'owner', code, options);
  const competing = (code) => publish(stranger, 'other', code);
  await assertFails(
    setDoc(reservation(professional, first), {
      ownerId: 'owner',
      patientId: 'patient',
    })
  );
  await assertFails(ownerPublishes(first, { reserve: false }));
  await assertSucceeds(ownerPublishes(first));
  const otherPatient = doc(stranger, 'professionals/other/patients/patient');
  await assertSucceeds(
    setDoc(otherPatient, {
      name: 'Outro paciente',
      code: '',
      therapy: null,
      revision: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  await assertFails(getDoc(doc(professional, otherPatient.path)));
  await assertFails(competing(first));
  await assertSucceeds(ownerPublishes(first, { reserve: false }));
  await assertFails(getDoc(patient(player)));
  await assertFails(getDoc(patient(stranger)));
  await assertFails(getDocs(collection(player, 'patientAccess')));
  assert.equal(
    (await assertSucceeds(getDoc(access(player, first)))).data().therapy.title,
    'Semáforo'
  );
  await assertFails(setDoc(access(player, first), { revision: 99 }));
  await assertFails(ownerPublishes(second));
  await assertSucceeds(ownerPublishes(second, { old: first }));
  await assertFails(getDoc(access(player, first)));
  await assertFails(getDoc(access(professional, first)));
  await assertSucceeds(getDoc(access(player, second)));
  await assertFails(ownerPublishes(first, { old: second }));
  await assertFails(competing(first));
  await assertFails(competing(legacy));
  await assertSucceeds(competing('DEH789'));
  for (const db of [professional, stranger, player]) {
    await assertFails(getDoc(reservation(db, first)));
    await assertFails(getDocs(collection(db, 'issuedPatientCodes')));
  }
  await assertFails(deleteDoc(reservation(professional, first)));
  console.log(
    'PASS emissão e rotação atômicas, reserva privada e bloqueio de reutilização'
  );
} finally {
  await env.cleanup();
}
