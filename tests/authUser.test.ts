import assert from "node:assert/strict"
import test from "node:test"
import { signedInUser } from "../shared/authUser.ts"

test("accepts a real signed-in user", () => {
  const user = signedInUser({
    id: "user-1",
    is_anonymous: false,
    email: "keanu@example.com",
  })
  assert.deepEqual(user, { id: "user-1", is_anonymous: false })
})

test("rejects anonymous users and junk payloads", () => {
  assert.equal(signedInUser({ id: "anon-1", is_anonymous: true }), null)
  assert.equal(signedInUser({ id: "" }), null)
  assert.equal(signedInUser({}), null)
  assert.equal(signedInUser(null), null)
  assert.equal(signedInUser("nope"), null)
})
