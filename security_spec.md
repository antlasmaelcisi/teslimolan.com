# Security Specification for teslimolan.com

## 1. Data Invariants
- A `Blog` document must always have a `title`, `content` (JSON string), `status` ('draft' or 'published'), `createdAt`, and `updatedAt`.
- Only authorized admins can create, update, or delete blogs.
- `createdAt` is immutable after creation.
- `updatedAt` must always match the server timestamp on every write.
- Anonymous or unverified users have zero write access.
- Published blogs are publicly readable; drafts are only readable by admins.
- `admins` collection contains the email addresses of authorized users.

## 2. The "Dirty Dozen" Payloads (Deny-Test Cases)

1. **Identity Spoofing (Create)**: Non-admin user attempts to create a blog.
2. **Identity Spoofing (Update)**: Non-admin user attempts to edit a published blog.
3. **Identity Spoofing (Delete)**: Non-admin user attempts to delete a blog.
4. **Unverified Email**: User with `email_verified: false` attempts admin actions.
5. **Shadow Field Injection**: Admin attempts to inject `isVerified: true` into a blog document.
6. **Immutability Breach**: Admin attempts to change the `createdAt` timestamp of an existing blog.
7. **Timestamp Poisoning**: Admin attempts to set `updatedAt` to a past or future date instead of `request.time`.
8. **Resource Exhaustion (ID)**: Attempt to create a blog with a 2KB document ID.
9. **Resource Exhaustion (Title)**: Attempt to create a blog with a 1MB title string.
10. **State Shortcut**: Attempt to update a blog without providing the `updatedAt` field.
11. **Malicious ID**: Attempt to create a blog with ID `../admins/attacker@gmail.com` (Path Traversal).
12. **PII Leak**: Non-admin attempts to `get` the full list of admin emails (if list was allowed).

## 3. The Test Runner (Mock Representation)

```typescript
// firestore.rules.test.ts
// This file simulates the verification of the rules against the Dirty Dozen payloads.
// In a real environment, this would run using @firebase/rules-unit-testing.

describe('teslimolan.com Security Rules', () => {
  it('should deny blog creation by non-admins', async () => {
    // Payload 1
    await assertFails(userDb.collection('blogs').add({ ...validBlog }));
  });

  it('should deny blog update by non-admins', async () => {
    // Payload 2
    await assertFails(userDb.collection('blogs').doc('blog-1').update({ title: 'Hacked' }));
  });

  it('should deny injection of ghost fields', async () => {
    // Payload 5
    const blogWithGhostField = { ...validBlog, ghostField: 'malicious' };
    await assertFails(adminDb.collection('blogs').add(blogWithGhostField));
  });

  it('should enforce createdAt immutability', async () => {
    // Payload 6
    await assertFails(adminDb.collection('blogs').doc('blog-1').update({ createdAt: Date.now() }));
  });

  it('should enforce server timestamps on updatedAt', async () => {
    // Payload 7
    await assertFails(adminDb.collection('blogs').doc('blog-1').update({ updatedAt: Date.now() }));
  });
  
  it('should enforce isValidId for document paths', async () => {
    // Payload 11
    await assertFails(adminDb.collection('blogs').doc('invalid/id').set(validBlog));
  });
});
```
