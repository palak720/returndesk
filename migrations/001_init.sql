CREATE TYPE request_status AS ENUM ('OPEN','IN_REVIEW','APPROVED','REJECTED','COMPLETED');
CREATE TYPE return_reason  AS ENUM ('DAMAGED','WRONG_ITEM','SIZE_ISSUE','NOT_AS_DESCRIBED','CHANGED_MIND');
CREATE TYPE resolution_type AS ENUM ('REFUND','REPLACEMENT','STORE_CREDIT');

CREATE SEQUENCE return_reference_seq START 1001;

CREATE TABLE return_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       text NOT NULL UNIQUE
                  DEFAULT ('RD-' || lpad(nextval('return_reference_seq')::text, 6, '0')),
  customer_name   text NOT NULL CHECK (length(btrim(customer_name)) > 0),
  customer_email  text NOT NULL CHECK (length(btrim(customer_email)) > 0),
  customer_phone  text,
  order_number    text NOT NULL CHECK (length(btrim(order_number)) > 0),
  item_sku        text NOT NULL CHECK (length(btrim(item_sku)) > 0),
  item_name       text NOT NULL CHECK (length(btrim(item_name)) > 0),
  quantity        integer NOT NULL CHECK (quantity >= 1),
  reason          return_reason NOT NULL,
  status          request_status NOT NULL DEFAULT 'OPEN',
  resolution      resolution_type,
  refund_amount   numeric(10,2),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,

  -- Rule 2: resolution aur refund amount ka rishta
  CONSTRAINT resolution_refund_rule CHECK (
    (resolution IS NULL AND refund_amount IS NULL)
    OR (resolution = 'REFUND' AND refund_amount > 0)
    OR (resolution IN ('REPLACEMENT','STORE_CREDIT') AND refund_amount IS NULL)
  ),
  -- Approved ya Completed bina resolution ke nahi ho sakta
  CONSTRAINT decided_needs_resolution CHECK (
    status NOT IN ('APPROVED','COMPLETED') OR resolution IS NOT NULL
  )
);

-- Rule 3: ek order + item par ek hi live request (race-proof)
CREATE UNIQUE INDEX one_live_request_per_item
  ON return_requests (order_number, item_sku)
  WHERE status NOT IN ('REJECTED','COMPLETED') AND deleted_at IS NULL;

CREATE INDEX idx_requests_status     ON return_requests (status)     WHERE deleted_at IS NULL;
CREATE INDEX idx_requests_reason     ON return_requests (reason)     WHERE deleted_at IS NULL;
CREATE INDEX idx_requests_created_at ON return_requests (created_at DESC) WHERE deleted_at IS NULL;

-- Notes: append-only
CREATE TABLE request_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  uuid NOT NULL REFERENCES return_requests(id),
  body        text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notes_request ON request_notes (request_id, created_at);