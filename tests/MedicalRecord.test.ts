import { describe, it, expect, beforeEach } from "vitest";
import { stringAsciiCV, uintCV, principalCV, buffCV, boolCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_RECORD_ID = 101;
const ERR_INVALID_HASH = 102;
const ERR_INVALID_METADATA = 103;
const ERR_INVALID_CONTENT = 104;
const ERR_RECORD_ALREADY_EXISTS = 105;
const ERR_RECORD_NOT_FOUND = 106;
const ERR_INVALID_CATEGORY = 109;
const ERR_INVALID_VERSION = 111;
const ERR_INVALID_EXPIRY = 114;
const ERR_INVALID_SIZE = 115;
const ERR_INVALID_TYPE = 116;
const ERR_INVALID_ACCESS_LEVEL = 117;
const ERR_INVALID_LOCATION = 118;
const ERR_MAX_RECORDS_EXCEEDED = 112;
const ERR_INVALID_UPDATE_PARAM = 113;

interface Record {
  patient: string;
  hash: Uint8Array;
  metadata: string;
  encryptedContent: Uint8Array;
  timestamp: number;
  category: string;
  status: boolean;
  version: number;
  expiry: number;
  size: number;
  type: string;
  accessLevel: number;
  location: string;
  provider: string;
}

interface RecordUpdate {
  updateHash: Uint8Array;
  updateMetadata: string;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class MedicalRecordMock {
  state: {
    nextRecordId: number;
    maxRecords: number;
    recordFee: number;
    adminPrincipal: string;
    records: Map<number, Record>;
    recordUpdates: Map<number, RecordUpdate>;
    recordsByPatient: Map<string, number[]>;
  } = {
    nextRecordId: 0,
    maxRecords: 10000,
    recordFee: 500,
    adminPrincipal: "ST1TEST",
    records: new Map(),
    recordUpdates: new Map(),
    recordsByPatient: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextRecordId: 0,
      maxRecords: 10000,
      recordFee: 500,
      adminPrincipal: "ST1TEST",
      records: new Map(),
      recordUpdates: new Map(),
      recordsByPatient: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
  }

  setAdminPrincipal(newAdmin: string): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.adminPrincipal = newAdmin;
    return { ok: true, value: true };
  }

  setMaxRecords(newMax: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newMax <= 0) return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
    this.state.maxRecords = newMax;
    return { ok: true, value: true };
  }

  setRecordFee(newFee: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newFee < 0) return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
    this.state.recordFee = newFee;
    return { ok: true, value: true };
  }

  addRecord(
    recordHash: Uint8Array,
    metadata: string,
    encryptedContent: Uint8Array,
    category: string,
    version: number,
    expiry: number,
    size: number,
    type: string,
    accessLevel: number,
    location: string,
    provider: string
  ): Result<number> {
    if (this.state.nextRecordId >= this.state.maxRecords) return { ok: false, value: ERR_MAX_RECORDS_EXCEEDED };
    if (recordHash.length !== 32) return { ok: false, value: ERR_INVALID_HASH };
    if (!metadata || metadata.length > 256) return { ok: false, value: ERR_INVALID_METADATA };
    if (encryptedContent.length > 1024) return { ok: false, value: ERR_INVALID_CONTENT };
    if (!["lab", "prescription", "imaging"].includes(category)) return { ok: false, value: ERR_INVALID_CATEGORY };
    if (version <= 0) return { ok: false, value: ERR_INVALID_VERSION };
    if (expiry <= this.blockHeight) return { ok: false, value: ERR_INVALID_EXPIRY };
    if (size <= 0) return { ok: false, value: ERR_INVALID_SIZE };
    if (!["pdf", "jpg", "txt"].includes(type)) return { ok: false, value: ERR_INVALID_TYPE };
    if (accessLevel > 5) return { ok: false, value: ERR_INVALID_ACCESS_LEVEL };
    if (location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (this.state.records.has(this.state.nextRecordId)) return { ok: false, value: ERR_RECORD_ALREADY_EXISTS };

    this.stxTransfers.push({ amount: this.state.recordFee, from: this.caller, to: this.state.adminPrincipal });

    const id = this.state.nextRecordId;
    const record: Record = {
      patient: this.caller,
      hash: recordHash,
      metadata,
      encryptedContent,
      timestamp: this.blockHeight,
      category,
      status: true,
      version,
      expiry,
      size,
      type,
      accessLevel,
      location,
      provider,
    };
    this.state.records.set(id, record);
    const patientRecords = this.state.recordsByPatient.get(this.caller) || [];
    if (patientRecords.length >= 100) return { ok: false, value: ERR_MAX_RECORDS_EXCEEDED };
    patientRecords.push(id);
    this.state.recordsByPatient.set(this.caller, patientRecords);
    this.state.nextRecordId++;
    return { ok: true, value: id };
  }

  getRecord(id: number): Record | undefined {
    return this.state.records.get(id);
  }

  updateRecord(id: number, updateHash: Uint8Array, updateMetadata: string, updateVersion: number): Result<boolean> {
    const record = this.state.records.get(id);
    if (!record) return { ok: false, value: ERR_RECORD_NOT_FOUND };
    if (record.patient !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (updateHash.length !== 32) return { ok: false, value: ERR_INVALID_HASH };
    if (!updateMetadata || updateMetadata.length > 256) return { ok: false, value: ERR_INVALID_METADATA };
    if (updateVersion <= 0) return { ok: false, value: ERR_INVALID_VERSION };

    const updated: Record = {
      ...record,
      hash: updateHash,
      metadata: updateMetadata,
      timestamp: this.blockHeight,
      version: updateVersion,
    };
    this.state.records.set(id, updated);
    this.state.recordUpdates.set(id, {
      updateHash,
      updateMetadata,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  getRecordCount(): Result<number> {
    return { ok: true, value: this.state.nextRecordId };
  }

  checkRecordExistence(id: number): Result<boolean> {
    return { ok: true, value: this.state.records.has(id) };
  }

  getPatientRecords(patient: string): number[] | undefined {
    return this.state.recordsByPatient.get(patient);
  }
}

describe("MedicalRecord", () => {
  let contract: MedicalRecordMock;

  beforeEach(() => {
    contract = new MedicalRecordMock();
    contract.reset();
  });

  it("adds a record successfully", () => {
    const hash = new Uint8Array(32).fill(1);
    const content = new Uint8Array(10).fill(2);
    const result = contract.addRecord(
      hash,
      "Blood Test",
      content,
      "lab",
      1,
      100000,
      1024,
      "pdf",
      1,
      "Hospital A",
      "ST2PROVIDER"
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const record = contract.getRecord(0);
    expect(record?.metadata).toBe("Blood Test");
    expect(record?.category).toBe("lab");
    expect(record?.version).toBe(1);
    expect(record?.type).toBe("pdf");
    expect(record?.accessLevel).toBe(1);
    expect(record?.provider).toBe("ST2PROVIDER");
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST1TEST" }]);
  });

  it("rejects invalid hash", () => {
    const hash = new Uint8Array(31).fill(1);
    const content = new Uint8Array(10).fill(2);
    const result = contract.addRecord(
      hash,
      "Blood Test",
      content,
      "lab",
      1,
      100000,
      1024,
      "pdf",
      1,
      "Hospital A",
      "ST2PROVIDER"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_HASH);
  });

  it("rejects invalid category", () => {
    const hash = new Uint8Array(32).fill(1);
    const content = new Uint8Array(10).fill(2);
    const result = contract.addRecord(
      hash,
      "Blood Test",
      content,
      "invalid",
      1,
      100000,
      1024,
      "pdf",
      1,
      "Hospital A",
      "ST2PROVIDER"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CATEGORY);
  });

  it("updates a record successfully", () => {
    const hash = new Uint8Array(32).fill(1);
    const content = new Uint8Array(10).fill(2);
    contract.addRecord(
      hash,
      "Old Metadata",
      content,
      "lab",
      1,
      100000,
      1024,
      "pdf",
      1,
      "Hospital A",
      "ST2PROVIDER"
    );
    const updateHash = new Uint8Array(32).fill(3);
    const result = contract.updateRecord(0, updateHash, "New Metadata", 2);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const record = contract.getRecord(0);
    expect(record?.metadata).toBe("New Metadata");
    expect(record?.version).toBe(2);
    const update = contract.state.recordUpdates.get(0);
    expect(update?.updateMetadata).toBe("New Metadata");
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update by non-patient", () => {
    const hash = new Uint8Array(32).fill(1);
    const content = new Uint8Array(10).fill(2);
    contract.addRecord(
      hash,
      "Blood Test",
      content,
      "lab",
      1,
      100000,
      1024,
      "pdf",
      1,
      "Hospital A",
      "ST2PROVIDER"
    );
    contract.caller = "ST3FAKE";
    const updateHash = new Uint8Array(32).fill(3);
    const result = contract.updateRecord(0, updateHash, "New Metadata", 2);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("sets record fee successfully", () => {
    const result = contract.setRecordFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.recordFee).toBe(1000);
    const hash = new Uint8Array(32).fill(1);
    const content = new Uint8Array(10).fill(2);
    contract.addRecord(
      hash,
      "Blood Test",
      content,
      "lab",
      1,
      100000,
      1024,
      "pdf",
      1,
      "Hospital A",
      "ST2PROVIDER"
    );
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST1TEST" }]);
  });

  it("rejects fee change by non-admin", () => {
    contract.caller = "ST3FAKE";
    const result = contract.setRecordFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("returns correct record count", () => {
    const hash1 = new Uint8Array(32).fill(1);
    const content1 = new Uint8Array(10).fill(2);
    contract.addRecord(
      hash1,
      "Test1",
      content1,
      "lab",
      1,
      100000,
      1024,
      "pdf",
      1,
      "Hospital A",
      "ST2PROVIDER"
    );
    const hash2 = new Uint8Array(32).fill(3);
    const content2 = new Uint8Array(10).fill(4);
    contract.addRecord(
      hash2,
      "Test2",
      content2,
      "prescription",
      1,
      100000,
      512,
      "txt",
      2,
      "Clinic B",
      "ST3PROVIDER"
    );
    const result = contract.getRecordCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks record existence correctly", () => {
    const hash = new Uint8Array(32).fill(1);
    const content = new Uint8Array(10).fill(2);
    contract.addRecord(
      hash,
      "Blood Test",
      content,
      "lab",
      1,
      100000,
      1024,
      "pdf",
      1,
      "Hospital A",
      "ST2PROVIDER"
    );
    const result = contract.checkRecordExistence(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkRecordExistence(99);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("rejects record addition with max records exceeded", () => {
    contract.state.maxRecords = 1;
    const hash1 = new Uint8Array(32).fill(1);
    const content1 = new Uint8Array(10).fill(2);
    contract.addRecord(
      hash1,
      "Test1",
      content1,
      "lab",
      1,
      100000,
      1024,
      "pdf",
      1,
      "Hospital A",
      "ST2PROVIDER"
    );
    const hash2 = new Uint8Array(32).fill(3);
    const content2 = new Uint8Array(10).fill(4);
    const result = contract.addRecord(
      hash2,
      "Test2",
      content2,
      "prescription",
      1,
      100000,
      512,
      "txt",
      2,
      "Clinic B",
      "ST3PROVIDER"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_RECORDS_EXCEEDED);
  });

  it("sets admin principal successfully", () => {
    const result = contract.setAdminPrincipal("ST2NEWADMIN");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.adminPrincipal).toBe("ST2NEWADMIN");
  });

  it("rejects admin change by non-admin", () => {
    contract.caller = "ST3FAKE";
    const result = contract.setAdminPrincipal("ST4NEW");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("gets patient records correctly", () => {
    const hash1 = new Uint8Array(32).fill(1);
    const content1 = new Uint8Array(10).fill(2);
    contract.addRecord(
      hash1,
      "Test1",
      content1,
      "lab",
      1,
      100000,
      1024,
      "pdf",
      1,
      "Hospital A",
      "ST2PROVIDER"
    );
    const hash2 = new Uint8Array(32).fill(3);
    const content2 = new Uint8Array(10).fill(4);
    contract.addRecord(
      hash2,
      "Test2",
      content2,
      "prescription",
      1,
      100000,
      512,
      "txt",
      2,
      "Clinic B",
      "ST3PROVIDER"
    );
    const records = contract.getPatientRecords("ST1TEST");
    expect(records).toEqual([0, 1]);
  });
});