import {
  get,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js";
import { auth, db } from "./firebase-config.js";

function cleanKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "item";
}

export function objectToArray(value) {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).map(([id, record]) => ({ id, ...(record || {}) }));
}

export function subscribePath(path, callback) {
  return onValue(ref(db, path), (snapshot) => callback(snapshot.val()));
}

export async function readPath(path) {
  const snap = await get(ref(db, path));
  return snap.exists() ? snap.val() : null;
}

export async function writePath(path, value) {
  await set(ref(db, path), value);
}

export async function patchPath(path, value) {
  await update(ref(db, path), value);
}

export async function deletePath(path) {
  await remove(ref(db, path));
}

export async function addRecord(path, record) {
  const recordRef = push(ref(db, path));
  await set(recordRef, {
    ...record,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return recordRef.key;
}

export async function updateRecord(path, id, changes) {
  await update(ref(db, `${path}/${id}`), {
    ...changes,
    updatedAt: serverTimestamp()
  });
}

export async function saveUserProfile(uid, profile) {
  await set(ref(db, `users/${uid}`), {
    ...profile,
    updatedAt: serverTimestamp()
  });
}

export async function setUserActive(uid, active) {
  await update(ref(db, `users/${uid}`), {
    active,
    updatedAt: serverTimestamp()
  });
}

export async function addInventoryItem(site, item) {
  const key = cleanKey(`${item.category}_${item.name}`);
  const itemRef = ref(db, `inventory/${site}/${key}`);
  const existing = await get(itemRef);

  if (existing.exists()) {
    await update(itemRef, {
      name: item.name.trim(),
      category: item.category,
      unit: item.unit || "unit",
      quantity: Number(item.quantity || 0),
      lowStockLevel: Number(item.lowStockLevel || 0),
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.uid || ""
    });
  } else {
    await set(itemRef, {
      name: item.name.trim(),
      category: item.category,
      unit: item.unit || "unit",
      quantity: Number(item.quantity || 0),
      lowStockLevel: Number(item.lowStockLevel || 0),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.uid || ""
    });
  }
  return key;
}

export async function adjustInventory(site, item, deltaQuantity) {
  const key = cleanKey(`${item.category}_${item.name}`);
  const itemRef = ref(db, `inventory/${site}/${key}`);

  await runTransaction(itemRef, (current) => {
    const base = current || {
      name: item.name,
      category: item.category,
      unit: item.unit || "unit",
      quantity: 0,
      lowStockLevel: 0,
      createdAt: Date.now()
    };

    return {
      ...base,
      quantity: Math.max(0, Number(base.quantity || 0) + Number(deltaQuantity || 0)),
      updatedAt: Date.now(),
      updatedBy: auth.currentUser?.uid || ""
    };
  });
}

export async function createRequest(site, payload) {
  return addRecord(`requests/${site}`, {
    ...payload,
    site,
    status: "requested",
    requestedByUid: auth.currentUser?.uid || ""
  });
}

export async function updateRequest(site, id, changes) {
  await updateRecord(`requests/${site}`, id, changes);
}

export async function createPorter(payload) {
  return addRecord("porters", {
    ...payload,
    active: payload.active !== false,
    createdByUid: auth.currentUser?.uid || ""
  });
}

export async function createTransit(payload) {
  const month = (payload.transitDate || new Date().toISOString().slice(0, 10)).slice(0, 7);
  return addRecord("transits", {
    ...payload,
    transitMonth: month,
    status: "in_transit",
    createdByUid: auth.currentUser?.uid || ""
  });
}

export async function verifyTransitArrival(transit) {
  const transitRef = ref(db, `transits/${transit.id}`);
  await update(transitRef, {
    status: "successful_transit",
    verifiedAt: serverTimestamp(),
    verifiedByUid: auth.currentUser?.uid || "",
    updatedAt: serverTimestamp()
  });

  for (const item of transit.items || []) {
    const qty = Number(item.quantity || 0);
    if (qty > 0 && ["KK", "KP", "PH"].includes(transit.destination)) {
      await adjustInventory(transit.destination, item, qty);
    }
  }

  if (transit.method === "porter") {
    const month = transit.transitMonth || (transit.transitDate || "").slice(0, 7);
    await set(ref(db, `billing/${month}/${transit.id}`), {
      transitId: transit.id,
      billNo: transit.billNo || "",
      transitDate: transit.transitDate || "",
      origin: transit.origin,
      destination: transit.destination,
      carrierPorterId: transit.carrierPorterId || "",
      paymentRecipientPorterId: "",
      totalAmount: Number(transit.totalAmount || 0),
      status: "awaiting_kp_bill_verification",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}

export async function verifyKpBill(month, transitId, paymentRecipientPorterId) {
  await update(ref(db, `billing/${month}/${transitId}`), {
    paymentRecipientPorterId,
    status: "awaiting_accounts_verification",
    kpVerifiedAt: serverTimestamp(),
    kpVerifiedByUid: auth.currentUser?.uid || "",
    updatedAt: serverTimestamp()
  });
}

export async function verifyAccountsBill(month, transitId) {
  await update(ref(db, `billing/${month}/${transitId}`), {
    status: "accounts_verified",
    accountsVerifiedAt: serverTimestamp(),
    accountsVerifiedByUid: auth.currentUser?.uid || "",
    updatedAt: serverTimestamp()
  });
}

export async function markBillPaid(month, transitId, paymentReference = "") {
  await update(ref(db, `billing/${month}/${transitId}`), {
    status: "paid",
    paymentReference,
    paidAt: serverTimestamp(),
    paidByUid: auth.currentUser?.uid || "",
    updatedAt: serverTimestamp()
  });
}

export async function logActivity(action, details = {}) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const activityRef = push(ref(db, `activity/${uid}`));
  await set(activityRef, {
    action,
    ...details,
    at: serverTimestamp()
  });
}
