import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';

const env = await initializeTestEnvironment({ projectId: 'demo-homephysio', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
try {
  const professional = env.authenticatedContext('owner', { email_verified: true }).firestore();
  const stranger = env.authenticatedContext('other', { email_verified: true }).firestore();
  const player = env.unauthenticatedContext().firestore();
  const patient = db => doc(db, 'professionals/owner/patients/patient');
  const access = (db, code) => doc(db, 'patientAccess', code);
  const first = 'C'.repeat(6), second = 'B'.repeat(6);
  assert.equal((await assertSucceeds(getDoc(access(professional, first)))).exists(), false);
  const therapy = { gameId:'shoulder', title:'Semáforo', intensity:'custom', metrics:['hits'], targets:'50/50,80/50', durationSeconds:60, repetitions:6, holdSeconds:.7, targetSeconds:6, tolerancePercent:12, postureTolerancePercent:20, pointsPerHit:10, side:'left' };
  await assertSucceeds(setDoc(patient(professional), { name:'Paciente fictício', code:'', therapy:null, revision:0, createdAt:serverTimestamp(), updatedAt:serverTimestamp() }));
  const publish = (code, revision, old) => {
    const batch = writeBatch(professional);
    batch.update(patient(professional), { code, revision, therapy, updatedAt:serverTimestamp() });
    batch.set(access(professional, code), { ownerId:'owner', patientId:'patient', revision, therapy });
    if (old) batch.set(access(professional, old), { revoked: true });
    return batch.commit();
  };
  await assertSucceeds(publish(first, 1));
  const otherPatient = doc(stranger, 'professionals/other/patients/patient');
  await assertSucceeds(setDoc(otherPatient, { name:'Outro paciente', code:'', therapy:null, revision:0, createdAt:serverTimestamp(), updatedAt:serverTimestamp() }));
  await assertFails(getDoc(doc(professional, otherPatient.path)));
  const competing = (code) => {
    const batch = writeBatch(stranger);
    batch.update(otherPatient, { code, therapy, revision:1, updatedAt:serverTimestamp() });
    batch.set(access(stranger, code), { ownerId:'other', patientId:'patient', revision:1, therapy });
    return batch.commit();
  };
  await assertFails(competing(first));
  await assertFails(competing('AAAAAA'));
  await assertSucceeds(competing('DEF789'));
  await assertSucceeds(publish(first, 2));
  await assertFails(getDoc(patient(player)));
  await assertFails(getDoc(patient(stranger)));
  await assertFails(getDocs(collection(player, 'patientAccess')));
  assert.equal((await assertSucceeds(getDoc(access(player, first)))).data().therapy.title, 'Semáforo');
  await assertFails(setDoc(access(player, first), { revision: 99 }));
  await assertFails(publish(second, 3));
  await assertSucceeds(publish(second, 3, first));
  await assertFails(getDoc(access(player, first)));
  await assertSucceeds(getDoc(access(player, second)));
  await assertFails(publish(first, 4, second));
  console.log('PASS cadastro, isolamento, acesso por código, edição e rotação atômica');
} finally { await env.cleanup(); }

