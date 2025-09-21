(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-RECORD-ID u101)
(define-constant ERR-INVALID-HASH u102)
(define-constant ERR-INVALID-METADATA u103)
(define-constant ERR-INVALID-CONTENT u104)
(define-constant ERR-RECORD-ALREADY-EXISTS u105)
(define-constant ERR-RECORD-NOT-FOUND u106)
(define-constant ERR-INVALID-TIMESTAMP u107)
(define-constant ERR-INVALID-PATIENT u108)
(define-constant ERR-INVALID-CATEGORY u109)
(define-constant ERR-INVALID-STATUS u110)
(define-constant ERR-INVALID-VERSION u111)
(define-constant ERR-MAX-RECORDS-EXCEEDED u112)
(define-constant ERR-INVALID-UPDATE-PARAM u113)
(define-constant ERR-INVALID-EXPIRY u114)
(define-constant ERR-INVALID-SIZE u115)
(define-constant ERR-INVALID-TYPE u116)
(define-constant ERR-INVALID-ACCESS-LEVEL u117)
(define-constant ERR-INVALID-LOCATION u118)
(define-constant ERR-INVALID-PROVIDER u119)
(define-constant ERR-INVALID-SIGNATURE u120)

(define-data-var next-record-id uint u0)
(define-data-var max-records uint u10000)
(define-data-var record-fee uint u500)
(define-data-var admin-principal principal tx-sender)

(define-map records
  uint
  {
    patient: principal,
    hash: (buff 32),
    metadata: (string-ascii 256),
    encrypted-content: (buff 1024),
    timestamp: uint,
    category: (string-ascii 50),
    status: bool,
    version: uint,
    expiry: uint,
    size: uint,
    type: (string-ascii 20),
    access-level: uint,
    location: (string-ascii 100),
    provider: principal
  }
)

(define-map records-by-patient
  principal
  (list 100 uint))

(define-map record-updates
  uint
  {
    update-hash: (buff 32),
    update-metadata: (string-ascii 256),
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-record (id uint))
  (map-get? records id)
)

(define-read-only (get-record-updates (id uint))
  (map-get? record-updates id)
)

(define-read-only (get-patient-records (patient principal))
  (map-get? records-by-patient patient)
)

(define-private (validate-hash (h (buff 32)))
  (if (is-eq (len h) u32)
      (ok true)
      (err ERR-INVALID-HASH))
)

(define-private (validate-metadata (m (string-ascii 256)))
  (if (and (> (len m) u0) (<= (len m) u256))
      (ok true)
      (err ERR-INVALID-METADATA))
)

(define-private (validate-content (c (buff 1024)))
  (if (<= (len c) u1024)
      (ok true)
      (err ERR-INVALID-CONTENT))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-category (cat (string-ascii 50)))
  (if (or (is-eq cat "lab") (is-eq cat "prescription") (is-eq cat "imaging"))
      (ok true)
      (err ERR-INVALID-CATEGORY))
)

(define-private (validate-status (s bool))
  (ok true)
)

(define-private (validate-version (v uint))
  (if (> v u0)
      (ok true)
      (err ERR-INVALID-VERSION))
)

(define-private (validate-expiry (e uint))
  (if (> e block-height)
      (ok true)
      (err ERR-INVALID-EXPIRY))
)

(define-private (validate-size (sz uint))
  (if (> sz u0)
      (ok true)
      (err ERR-INVALID-SIZE))
)

(define-private (validate-type (t (string-ascii 20)))
  (if (or (is-eq t "pdf") (is-eq t "jpg") (is-eq t "txt"))
      (ok true)
      (err ERR-INVALID-TYPE))
)

(define-private (validate-access-level (al uint))
  (if (<= al u5)
      (ok true)
      (err ERR-INVALID-ACCESS-LEVEL))
)

(define-private (validate-location (loc (string-ascii 100)))
  (if (<= (len loc) u100)
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-provider (p principal))
  (ok true)
)

(define-public (set-admin-principal (new-admin principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (var-set admin-principal new-admin)
    (ok true)
  )
)

(define-public (set-max-records (new-max uint))
  (begin
    (asserts! (is-eq tx-sender (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-max u0) (err ERR-INVALID-UPDATE-PARAM))
    (var-set max-records new-max)
    (ok true)
  )
)

(define-public (set-record-fee (new-fee uint))
  (begin
    (asserts! (is-eq tx-sender (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (var-set record-fee new-fee)
    (ok true)
  )
)

(define-public (add-record
  (record-hash (buff 32))
  (metadata (string-ascii 256))
  (encrypted-content (buff 1024))
  (category (string-ascii 50))
  (version uint)
  (expiry uint)
  (size uint)
  (type (string-ascii 20))
  (access-level uint)
  (location (string-ascii 100))
  (provider principal)
)
  (let (
        (next-id (var-get next-record-id))
        (current-max (var-get max-records))
        (patient tx-sender)
        (patient-records (default-to (list) (map-get? records-by-patient patient)))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-RECORDS-EXCEEDED))
    (try! (validate-hash record-hash))
    (try! (validate-metadata metadata))
    (try! (validate-content encrypted-content))
    (try! (validate-category category))
    (try! (validate-version version))
    (try! (validate-expiry expiry))
    (try! (validate-size size))
    (try! (validate-type type))
    (try! (validate-access-level access-level))
    (try! (validate-location location))
    (try! (validate-provider provider))
    (asserts! (is-none (get-record next-id)) (err ERR-RECORD-ALREADY-EXISTS))
    (try! (stx-transfer? (var-get record-fee) tx-sender (var-get admin-principal)))
    (map-set records next-id
      {
        patient: patient,
        hash: record-hash,
        metadata: metadata,
        encrypted-content: encrypted-content,
        timestamp: block-height,
        category: category,
        status: true,
        version: version,
        expiry: expiry,
        size: size,
        type: type,
        access-level: access-level,
        location: location,
        provider: provider
      }
    )
    (map-set records-by-patient patient (unwrap! (as-max-len? (append patient-records next-id) u100) (err ERR-MAX-RECORDS-EXCEEDED)))
    (var-set next-record-id (+ next-id u1))
    (print { event: "record-added", id: next-id })
    (ok next-id)
  )
)

(define-public (update-record
  (record-id uint)
  (update-hash (buff 32))
  (update-metadata (string-ascii 256))
  (update-version uint)
)
  (let ((record (map-get? records record-id)))
    (match record
      r
        (begin
          (asserts! (is-eq (get patient r) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-hash update-hash))
          (try! (validate-metadata update-metadata))
          (try! (validate-version update-version))
          (map-set records record-id
            {
              patient: (get patient r),
              hash: update-hash,
              metadata: update-metadata,
              encrypted-content: (get encrypted-content r),
              timestamp: block-height,
              category: (get category r),
              status: (get status r),
              version: update-version,
              expiry: (get expiry r),
              size: (get size r),
              type: (get type r),
              access-level: (get access-level r),
              location: (get location r),
              provider: (get provider r)
            }
          )
          (map-set record-updates record-id
            {
              update-hash: update-hash,
              update-metadata: update-metadata,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "record-updated", id: record-id })
          (ok true)
        )
      (err ERR-RECORD-NOT-FOUND)
    )
  )
)

(define-public (get-record-count)
  (ok (var-get next-record-id))
)

(define-public (check-record-existence (id uint))
  (ok (is-some (get-record id)))
)