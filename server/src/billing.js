// Licences for the Pro plan, independent of the payment provider (see paddle.js).
// One licence per subscription: the first paid checkout creates it, renewals reuse it,
// and subscription status changes switch it on or off.
import crypto from 'node:crypto';

const ACTIVE = ['active', 'trialing', 'past_due'];
const KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newLicenseKey() {
  const bytes = crypto.randomBytes(16);
  let s = '';
  for (let i = 0; i < 16; i++) s += KEY_ALPHABET[bytes[i] % KEY_ALPHABET.length];
  return `GV-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}`;
}

export function licenseIsActive(lic) {
  return !!lic && ACTIVE.includes(lic.status);
}

// Idempotent per payment reference (e.g. a Paddle transaction ID) and per subscription.
export async function ensureLicense(store, {ref, installId = null, email = null, customerId = null, subscriptionId = null, provider}) {
  return store.transaction(async tx => {
    const seen = await tx.get('checkouts', ref);
    if (seen) return seen.licenseKey;
    const sub = subscriptionId ? await tx.get('subscriptions', String(subscriptionId)) : null;
    if (sub) {
      tx.set('checkouts', ref, {licenseKey: sub.licenseKey});
      return sub.licenseKey;
    }
    const key = newLicenseKey();
    tx.set('licenses', key, {
      status: 'active', plan: 'pro', provider, email, customerId, subscriptionId,
      firstRef: ref, installIds: installId ? [installId] : [], createdAt: new Date()
    });
    tx.set('checkouts', ref, {licenseKey: key});
    if (subscriptionId) tx.set('subscriptions', String(subscriptionId), {licenseKey: key});
    if (installId) tx.set('installs', installId, {licenseKey: key});
    return key;
  });
}

export async function setSubscriptionStatus(store, subscriptionId, status) {
  const link = await store.get('subscriptions', String(subscriptionId));
  if (!link) return false;
  await store.transaction(async tx => tx.set('licenses', link.licenseKey, {status, updatedAt: new Date()}));
  return true;
}

export async function activateLicense(store, installId, key, maxDevices = 3) {
  return store.transaction(async tx => {
    const lic = await tx.get('licenses', key);
    if (!lic) return {ok: false, error: 'That licence key wasn’t found. Check for typos.'};
    if (!licenseIsActive(lic)) return {ok: false, error: 'That licence isn’t active. Check your subscription.'};
    const ids = lic.installIds || [];
    if (!ids.includes(installId)) {
      if (ids.length >= maxDevices) return {ok: false, error: `This licence is already on ${maxDevices} browsers. Email support to move it.`};
      tx.set('licenses', key, {installIds: [...ids, installId]});
    }
    tx.set('installs', installId, {licenseKey: key});
    return {ok: true};
  });
}

export async function planFor(store, installId) {
  const link = await store.get('installs', installId);
  if (!link) return 'free';
  const lic = await store.get('licenses', link.licenseKey);
  return licenseIsActive(lic) && (lic.installIds || []).includes(installId) ? 'pro' : 'free';
}
