# Accessible API Tester — Beginner Testing Manual

> **Who is this for?**
> This manual is written for someone who has never done API testing before. Every term is explained. Every step is shown. You only need to be able to open the app and follow instructions.

---

## Before You Start — Understanding the Basics

### What is an API?

An API is a way for one computer program to talk to another. When you open a weather app and it shows today's temperature, it sent a request to a weather server and got data back. That request-and-response is an API call.

### What is API Testing?

API testing means you manually send those requests yourself and check whether the response is correct — right status, right data, no errors.

### What is JSON?

JSON is the format most APIs use to send data. It looks like this:

```json
{
  "name": "John",
  "age": 30,
  "city": "Mumbai"
}
```

Curly braces `{}` hold the data. Each piece of data has a name (called a key) and a value, separated by a colon.

### What are Status Codes?

Every response comes with a number that tells you if it worked:

| Code | Meaning | Think of it as |
|---|---|---|
| 200 | OK — success | ✅ Done |
| 201 | Created — new item was made | ✅ Created |
| 204 | No Content — success, nothing to return | ✅ Deleted |
| 400 | Bad Request — you sent something wrong | ❌ Your mistake |
| 401 | Unauthorized — wrong or missing credentials | 🔒 Not logged in |
| 403 | Forbidden — you don't have permission | 🚫 Not allowed |
| 404 | Not Found — that thing doesn't exist | ❓ Wrong address |
| 500 | Server Error — the server broke | 💥 Server's fault |

---

## How to Open the App

1. Open PowerShell
2. Navigate to the app folder
3. Run: `.\run-desktop.ps1`
4. A window opens — this is the Accessible API Tester

---

## The App Layout

When the app opens, you will see:

- **Top navigation bar** — links to different sections, plus a Dark/Light mode toggle button on the right
- **Main area** — where you do the actual work

### Navigation Sections

| Section | What it is for |
|---|---|
| Home | Welcome screen with dashboard cards |
| Workspace | Switch between project workspaces |
| Requests | Send API requests (main work area) |
| Collections | Saved requests you can reuse and run |
| History | All requests you have sent before |
| Variables | Store reusable values (API keys, base URLs, secrets) |
| Environments | Save named variable profiles for dev, staging, prod |
| Mock Server | Create fake API endpoints for testing |
| Google OAuth | Get a Google access token using PKCE |
| Settings | Global defaults — SSL, proxy, timeout |

### Dark / Light Mode

Click the **Light / Dark** button at the far right of the navigation bar to toggle the colour theme.

---

## SECTION 1 — Your First Request (GET)

**What we are testing:** Can the app send a basic GET request and show the response?

**What is a GET request?** It means "give me some data." Like asking a question.

### Steps

1. Click **Requests** in the navigation bar
2. Make sure the method dropdown shows **GET**
3. In the URL box, type exactly:
   ```
   https://jsonplaceholder.typicode.com/posts/1
   ```
4. Click the **Send** button
5. Look at the response area on the right

### What you should see

- Status: **200 OK**
- Response time: under 1000ms (1 second)
- Response body (JSON):
  ```json
  {
    "userId": 1,
    "id": 1,
    "title": "sunt aut facere repellat...",
    "body": "quia et suscipit..."
  }
  ```

### Response Panel Tabs

After sending, the Response section shows several tabs:
- **Body** — the formatted response text
- **Tree** — a collapsible JSON tree (great for large responses)
- **Headers** — all HTTP headers the server returned
- **Raw** — the raw unformatted response
- **Preview** — renders images or HTML responses visually

### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Status code | 200 | |
| Response has "id" field | Yes | |
| Response has "title" field | Yes | |
| No error message shown | Yes | |

---

## SECTION 2 — Fetching a List (GET with multiple items)

**What we are testing:** Can the app handle a response with many items?

### Steps

1. In Requests, clear the URL and type:
   ```
   https://jsonplaceholder.typicode.com/posts
   ```
2. Method stays **GET**
3. Click **Send**

### What you should see

- Status: **200 OK**
- Response body: a JSON array starting with `[` — a list of 100 posts

### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Status code | 200 | |
| Response starts with `[` (array) | Yes | |
| Multiple items visible | Yes | |

---

## SECTION 3 — Creating Data (POST)

**What we are testing:** Can the app send a POST request with a JSON body?

**What is a POST request?** It means "create something new." Like submitting a form.

### Steps

1. Change the method dropdown to **POST**
2. Set the URL to:
   ```
   https://jsonplaceholder.typicode.com/posts
   ```
3. Below the URL, find the **Body** section
4. Make sure **Body mode** is set to **Raw JSON**
5. In the body text area, type:
   ```json
   {
     "title": "My First Post",
     "body": "This is the content of my post.",
     "userId": 1
   }
   ```
6. Click **Send**

### What you should see

- Status: **201 Created**
- Response body shows your data back plus a new `"id"` field:
  ```json
  {
    "id": 101,
    "title": "My First Post",
    "body": "This is the content of my post.",
    "userId": 1
  }
  ```

### Body Modes Available

The Body mode dropdown offers five options:

| Mode | Use it when |
|---|---|
| Raw JSON | Sending JSON data (most common) |
| Raw text | Sending plain text |
| GraphQL | Sending a GraphQL query |
| x-www-form-urlencoded | Submitting HTML form fields |
| multipart/form-data | Uploading files along with form fields |

### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Status code | 201 | |
| Response contains "id" | Yes | |
| Response contains your title | Yes | |

---

## SECTION 4 — Query Parameters

**What we are testing:** Can the app add query parameters to a URL?

**What are query parameters?** Extra filters added to a URL after a `?`. For example:
`https://site.com/posts?userId=1` means "give me posts where userId is 1."

### Steps

1. Method: **GET**
2. URL:
   ```
   https://jsonplaceholder.typicode.com/posts
   ```
3. Find the **Query params** section (below the URL bar)
4. In the Name column type: `userId`
5. In the Value column type: `1`
6. Click **Send**

### What you should see

- Status: **200 OK**
- Only posts where `"userId": 1` appear in the response (10 posts)

### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Status code | 200 | |
| All response items have "userId": 1 | Yes | |
| Fewer results than without the filter | Yes | |

---

## SECTION 5 — Custom Headers

**What we are testing:** Can the app send custom headers with a request?

**What are headers?** Extra information sent alongside a request — like metadata. Common headers include `Content-Type` (what format the body is in) and `Authorization` (your credentials).

### Steps

1. Method: **GET**
2. URL:
   ```
   https://httpbin.org/headers
   ```
3. Find the **Headers** section (below the URL bar)
4. Add a new row:
   - Name: `X-Custom-Header`
   - Value: `HelloFromTester`
5. Click **Send**

### What you should see

- Status: **200 OK**
- Response body shows all headers the server received, including your custom one:
  ```json
  {
    "headers": {
      "X-Custom-Header": "HelloFromTester",
      ...
    }
  }
  ```

### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Status code | 200 | |
| Your custom header appears in response | Yes | |

---

## SECTION 6 — Authentication

**What we are testing:** Can the app attach authentication credentials to a request?

The app supports four authentication types, selectable from the **Auth type** dropdown in the **Authorization** section.

---

### 6A — Bearer Token

**What is a Bearer token?** It is like a keycard. You send it with every request to prove who you are.

#### Steps

1. Method: **GET**
2. URL:
   ```
   https://httpbin.org/bearer
   ```
3. In the **Authorization** section, set **Auth type** to **Bearer token**
4. In the **Token** field, type: `my-test-token-12345`
5. Click **Send**

#### What you should see

- Status: **200 OK**
- Response body:
  ```json
  {
    "authenticated": true,
    "token": "my-test-token-12345"
  }
  ```

#### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Status code | 200 | |
| "authenticated" is true | Yes | |
| Token value matches what you entered | Yes | |

---

### 6B — Basic Auth

**What is Basic auth?** You send a username and password in the format `username:password`. The app encodes it for you.

#### Steps

1. Method: **GET**
2. URL:
   ```
   https://httpbin.org/basic-auth/testuser/testpass
   ```
3. In the **Authorization** section, set **Auth type** to **Basic auth**
4. In the **Credentials** field, type: `testuser:testpass`
5. Click **Send**

#### What you should see

- Status: **200 OK**
- Response:
  ```json
  {
    "authenticated": true,
    "user": "testuser"
  }
  ```

#### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Status code | 200 | |
| "authenticated" is true | Yes | |

---

### 6C — API Key Auth

**What is an API key?** A fixed secret string you send either as a header or a query parameter.

#### Steps

1. Method: **GET**
2. URL:
   ```
   https://httpbin.org/headers
   ```
3. In the **Authorization** section, set **Auth type** to **API key**
4. **Key name**: `X-API-Key`
5. **Key value**: `my-secret-key-abc`
6. **Send in**: `Header`
7. Click **Send**

#### What you should see

- Status: **200 OK**
- Response shows `"X-Api-Key": "my-secret-key-abc"` in the echoed headers

#### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Status code | 200 | |
| API key appears in response headers | Yes | |

---

### 6D — Folder Auth Inheritance

Requests saved inside a collection folder can **inherit** the folder's auth settings instead of setting auth on each request individually.

#### Steps

1. Save a request into a collection folder (see Section 11)
2. In the Collections panel, click the **Auth** button on the folder
3. Set the folder's auth type and token
4. Open a request in that folder
5. In the **Authorization** section, set **Auth type** to **Inherit from folder**
6. Click **Send** — the folder's credentials are used automatically

---

## SECTION 7 — Updating Data (PUT)

**What we are testing:** Can the app send a PUT request to update an existing item?

**What is a PUT request?** It replaces an entire item with new data.

### Steps

1. Method: **PUT**
2. URL:
   ```
   https://jsonplaceholder.typicode.com/posts/1
   ```
3. Body mode: **Raw JSON**
4. Body:
   ```json
   {
     "id": 1,
     "title": "Updated Title",
     "body": "Updated body content.",
     "userId": 1
   }
   ```
5. Click **Send**

### What you should see

- Status: **200 OK**
- Response contains your updated title

### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Status code | 200 | |
| Response contains "Updated Title" | Yes | |

---

## SECTION 8 — Deleting Data (DELETE)

**What we are testing:** Can the app send a DELETE request?

### Steps

1. Method: **DELETE**
2. URL:
   ```
   https://jsonplaceholder.typicode.com/posts/1
   ```
3. No body needed
4. Click **Send**

### What you should see

- Status: **200 OK**
- Response body: `{}` (empty — the item was deleted)

### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Status code | 200 | |
| Response body is empty `{}` | Yes | |

---

## SECTION 9 — Handling a 404 (Not Found)

**What we are testing:** Does the app correctly show an error when a resource does not exist?

### Steps

1. Method: **GET**
2. URL:
   ```
   https://jsonplaceholder.typicode.com/posts/99999
   ```
3. Click **Send**

### What you should see

- Status: **404 Not Found**
- Response body: `{}`

### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Status code | 404 | |
| App shows 404 clearly | Yes | |
| App does not crash | Yes | |

---

## SECTION 10 — Variables

**What we are testing:** Can the app store reusable values and use them in requests?

**Why use variables?** Instead of typing `https://jsonplaceholder.typicode.com` in every request, you save it once as `{{base_url}}` and use that everywhere.

---

### 10A — Workspace Variables

#### Steps — Create a variable

1. Click **Variables** in the navigation bar
2. In the **Variable name** field, type: `base_url`
3. In the **Variable value** field, type: `https://jsonplaceholder.typicode.com`
4. Click **Save variable**

#### Steps — Use the variable

1. Go to **Requests**
2. Method: **GET**
3. URL: `{{base_url}}/posts/1`
4. Click **Send**

#### What you should see

- The app replaces `{{base_url}}` with the actual URL before sending
- Status: **200 OK**

#### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Variable was saved | Yes | |
| `{{base_url}}` resolved correctly | Yes | |
| Status code | 200 | |

---

### 10B — Secret (Masked) Variables

Use secret variables for API keys, passwords, and tokens. The value is hidden behind dots on screen.

#### Steps

1. In **Variables**, type a name like `api_token`
2. Type any value
3. Check the **Secret (masked)** checkbox before saving
4. The variable appears in the list with a **secret** badge and dots instead of the value
5. Click the eye icon on a secret variable to reveal its value temporarily

---

### 10C — Collection Variables

Collection variables are available to all requests as a fallback when no workspace variable with the same name exists. They are useful for values that should apply to an entire collection but can be overridden per environment.

#### Steps

1. In **Variables**, scroll to the **Collection Variables** section
2. Add a variable name and value (e.g., `apiVersion` = `v2`)
3. Use it in requests as `{{apiVersion}}` — workspace variables override it if they have the same name

---

### 10D — Cookie Jar

The Cookie Jar automatically saves cookies set by API responses and sends them with future requests to the same host (like a browser does).

#### Steps

1. In **Variables**, scroll to the **Cookie Jar** section
2. Toggle **Enabled** on
3. Send a request to an API that sets cookies
4. The cookies appear in the Cookie Jar, grouped by hostname
5. Future requests to that host will automatically include the cookies

---

## SECTION 11 — Collections and Folders

**What we are testing:** Can the app save requests, organise them in folders, and import from other tools?

---

### 11A — Saving a Request

#### Steps — Save a request

1. Go to **Requests**
2. Method: **GET**, URL: `https://jsonplaceholder.typicode.com/posts/1`
3. In the **Request name** field (top of the form), type: `Get Post 1`
4. Click **Save**
5. Click **Collections** in the navigation bar — your saved request appears in the list

#### Steps — Reopen a saved request

1. In **Collections**, find `Get Post 1`
2. Click on it to load it into the request form
3. Click **Send** to verify it still works

#### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Request appears in Collections | Yes | |
| Reopened request has correct URL | Yes | |
| Reopened request sends successfully | Yes | |

---

### 11B — Organising into Folders

Folders let you group related requests (for example, all user-management endpoints together).

#### Steps

1. In **Requests**, type a request name (e.g., `Create User`)
2. Under **Folder**, select **New folder** and type a folder name (e.g., `Users`)
3. Click **Save**
4. In **Collections**, the request appears inside a collapsible `Users` folder
5. Click the folder name to expand/collapse it

---

### 11C — Folder Auth Settings

A folder can have shared auth credentials that all requests inside it can inherit.

#### Steps

1. In **Collections**, click the **Auth** button on any folder
2. Set the auth type and token for the folder
3. On any request inside that folder, set **Auth type** to **Inherit from folder**
4. The folder's credentials are used automatically when you send

---

### 11D — Importing a cURL Command

If you have a cURL command (copied from a browser, documentation, or terminal), the app can convert it into a saved request automatically.

#### Steps

1. In **Collections**, find the **Import cURL** text area
2. Paste a cURL command, for example:
   ```
   curl -X POST https://jsonplaceholder.typicode.com/posts \
     -H "Content-Type: application/json" \
     -d '{"title":"test","body":"content","userId":1}'
   ```
3. Click **Import cURL**
4. The request is added to your Collections

---

### 11E — Importing from Other Tools

The app can import collections from Postman, Insomnia, and OpenAPI specs.

#### Steps

1. In **Collections**, click **Import JSON / Postman / Insomnia**
2. Select a `.json` file exported from Postman or Insomnia
3. All requests from that collection are imported

To import an OpenAPI spec:
1. Click **Import OpenAPI**
2. Select a `.json` or `.yaml` OpenAPI file
3. All endpoints are converted to saved requests

---

## SECTION 12 — Request History

**What we are testing:** Does the app automatically record all sent requests?

### Steps

1. Click **History** in the navigation bar
2. Look for the requests you sent in previous sections
3. Use the **Search history** field to filter by method, URL, or status code

### What you should see

- A list of your recent requests with method, URL, and status code
- Clicking any history item loads it into the request form
- The search field filters the list as you type

### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Previous requests appear in history | Yes | |
| History shows status code | Yes | |
| Clicking an item loads it into the form | Yes | |
| Search field filters the list | Yes | |

---

## SECTION 13 — Assertions (Automated Checks)

**What we are testing:** Can the app automatically verify the response for you?

**What is an assertion?** A rule you set in advance — "if the status is not 200, mark this as failed."

The app has three levels of assertion:

---

### 13A — Status Code and Body

#### Steps

1. Go to **Requests**, set Method: **GET**, URL: `https://jsonplaceholder.typicode.com/posts/1`
2. Find the **Assertions** section (expand it if collapsed)
3. Set **Expected status code**: `200`
4. Set **Body contains**: `userId`
5. Click **Send**

#### What you should see

- The Assertions result shows: both assertions passed
- Summary shows "2 passed, 0 failed"

#### Test a failing assertion

1. Change **Expected status code** to `999`
2. Click **Send** again
3. The status code assertion fails (shown in red)

#### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Passing assertions show green / passed | Yes | |
| Failing assertion shows red / failed | Yes | |
| Summary count is correct | Yes | |

---

### 13B — Response Header Assertion

You can assert that a specific response header has a particular value.

#### Steps

1. In the **Assertions** section, find **Header name** and type: `Content-Type`
2. In **Header value contains**, type: `application/json`
3. Click **Send**

#### What you should see

- The header assertion passes because the response includes `Content-Type: application/json`

---

### 13C — JSONPath Assertions

JSONPath assertions let you check deeply nested values in the JSON response body with precision.

**Example:** The response from `/posts/1` is `{ "userId": 1, "id": 1, "title": "...", "body": "..." }`. A JSONPath assertion lets you check that `$.userId` equals `1`.

#### Steps

1. In the **Assertions** section, click **Add JSONPath assertion**
2. A new row appears with three fields:
   - **JSONPath**: `$.userId`
   - **Operator**: `equals`
   - **Expected value**: `1`
3. Click **Send**
4. The assertion passes because `userId` in the response is `1`

#### Available operators

| Operator | What it checks |
|---|---|
| equals | Value is exactly this |
| not equals | Value is not this |
| contains | Value includes this text |
| matches regex | Value matches the regular expression |
| exists | The field exists (no value needed) |
| not exists | The field does not exist |
| > greater than | Numeric: value is greater than |
| < less than | Numeric: value is less than |
| ≥ at least | Numeric: value is at least |
| ≤ at most | Numeric: value is at most |
| length = | Array or string length equals |
| length > | Array or string length is greater than |
| length < | Array or string length is less than |

#### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| JSONPath assertion added | Yes | |
| Assertion passes with correct path and value | Yes | |
| Changing to wrong expected value makes it fail | Yes | |

---

## SECTION 14 — Captures

**What we are testing:** Can the app automatically extract a value from the response and save it as a variable?

**What is a capture?** After a request completes, a capture reads a value from the response — from the JSON body, a header, or the status code — and saves it as a variable. You can then use that variable `{{variableName}}` in the next request.

**Example use case:** You log in and the response includes an `access_token`. You capture it as `{{token}}` and use it automatically in all subsequent requests.

### Steps

1. Go to **Requests**, set Method: **POST**, URL: `https://jsonplaceholder.typicode.com/posts`
2. Set Body mode to **Raw JSON**, body:
   ```json
   { "title": "test", "body": "content", "userId": 1 }
   ```
3. Find the **Captures** section (expand it if collapsed)
4. Click **Add capture**
5. A new row appears with three fields:
   - **Variable**: type `createdId`
   - **From**: select `Body (JSON)`
   - **Path**: type `id`
6. Click **Send**

### What you should see

- After the response arrives, a **Captured Variables** box appears showing: `createdId = 101`
- The variable `{{createdId}}` is now saved and available in all requests

### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Capture row added | Yes | |
| "Captured Variables" appears after sending | Yes | |
| Variable value matches the field in the response | Yes | |
| Variable available in subsequent requests | Yes | |

---

## SECTION 15 — Scripts (Pre-request and Post-response)

**What we are testing:** Can the app run custom JavaScript before or after a request?

**What are scripts?** Small JavaScript programs you write that run automatically:
- **Pre-request script** — runs before the request is sent (useful for setting dynamic variables or fetching a token first)
- **Post-response script** — runs after the response arrives (useful for running tests or chaining follow-up requests)

Both scripts support the `pm` API (similar to Postman scripts), so existing Postman scripts work here too.

---

### 15A — Pre-request Script

#### Steps

1. Find the **Pre-request script** section (expand it if collapsed)
2. Type this script:
   ```javascript
   pm.environment.set("timestamp", String(Date.now()));
   ```
3. Add `{{timestamp}}` somewhere in your request (e.g., as a header value)
4. Click **Send**

#### What you should see

- The `{{timestamp}}` variable is filled with the current Unix timestamp before the request is sent
- Script output appears in the **Scripts** tab of the response panel

---

### 15B — Post-response Script

#### Steps

1. Find the **Post-response script** section (expand it if collapsed)
2. Type this script:
   ```javascript
   pm.test("Status is 200", () => {
     pm.expect(pm.response.status).to.equal(200);
   });
   ```
3. Click **Send**
4. Click the **Scripts** tab in the Response panel

#### What you should see

- Script test result: `Status is 200 — passed`

#### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Pre-request script runs before send | Yes | |
| Variable set in script is used in the request | Yes | |
| Post-response script result appears in Scripts tab | Yes | |
| Script test passes with correct status | Yes | |

---

## SECTION 16 — Code Snippet Generator

**What we are testing:** Can the app generate ready-to-use code for the current request?

**What is a code snippet?** A generated piece of code that makes the same API call in a programming language. You can copy it into your own project.

### Steps

1. Build any request (e.g., GET `https://jsonplaceholder.typicode.com/posts/1`)
2. Click the **Snippet** button (below the request form)
3. Use the **Language** dropdown to select one:
   - **cURL** — command-line HTTP tool
   - **JavaScript (fetch)** — browser or Node.js code
   - **Python (requests)** — Python HTTP library
   - **C# (HttpClient)** — .NET HTTP client
4. Read the generated code in the box below
5. Click **Copy** to copy it to the clipboard

### What you should see

- A code block showing the exact same request in the selected language
- Clicking Copy puts the code on your clipboard

### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Snippet panel opens | Yes | |
| Generated code matches the current request | Yes | |
| Language can be changed | Yes | |
| Copy button works | Yes | |

---

## SECTION 17 — Running a Collection (Automated Test Run)

**What we are testing:** Can the app run multiple saved requests in sequence automatically?

### Steps — Prepare

1. Save at least 2 requests to Collections (you already did this in Section 11)
2. Add a second request: GET `https://jsonplaceholder.typicode.com/posts/2`, name it `Get Post 2`, save it

### Steps — Run

1. Go to **Collections**
2. Use the checkboxes next to each request to include or exclude it from the run
3. Click the **Run** button at the top
4. Watch the app send each request one by one
5. See the results table at the bottom showing pass/fail per request

### Steps — Export Results

1. After the run completes, click **Export CSV** in the Run results section
2. A CSV file downloads with all request names, status codes, pass/fail results, and timings

### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| All included requests run automatically | Yes | |
| Results table shows each request | Yes | |
| Passed/failed count shown | Yes | |
| Export CSV downloads a file | Yes | |

---

## SECTION 18 — Exporting and Importing Collections

**What we are testing:** Can the app export and import collections in different formats?

---

### Export

1. Go to **Collections**
2. Click **Export JSON** — downloads all saved requests in the app's native format
3. Click **Export Postman** — downloads a Postman-compatible `postman-collection.json`

---

### Import

The app supports four import formats:

| Format | How to import |
|---|---|
| Native JSON | Click **Import JSON / Postman / Insomnia**, select the `.json` file |
| Postman collection | Same button — works with Postman v2.1 exports |
| Insomnia collection | Same button — works with Insomnia exports |
| OpenAPI spec | Click **Import OpenAPI**, select a `.json` or `.yaml` file |

### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| JSON export file downloads | Yes | |
| Postman export file downloads | Yes | |
| Importing a JSON file adds requests to Collections | Yes | |

---

## SECTION 19 — Mock Server

**What we are testing:** Can the app simulate a fake API endpoint?

**What is a Mock Server?** Sometimes the real API is not ready yet, or you want to test without hitting a real server. A mock server lets you create a fake endpoint that returns whatever you want.

### Steps — Create a mock

1. Click **Mock Server** in the navigation bar
2. Fill in:
   - **Mock name:** `Fake Users`
   - **Method:** `GET`
   - **Path under /mock:** `/users`
   - **Status:** `200`
   - **Response content type:** `application/json`
   - **Delay (ms):** `0` (or set a delay, e.g. `500` to simulate a slow server)
   - **Response headers:** (optional, one per line, e.g. `Cache-Control: no-store`)
   - **Response body:**
     ```json
     [
       { "id": 1, "name": "Alice" },
       { "id": 2, "name": "Bob" }
     ]
     ```
3. Click **Save mock**

### Steps — Test the mock

1. Go to **Requests**
2. Method: **GET**
3. URL: `http://127.0.0.1:5090/mock/users`
4. Click **Send**

### What you should see

- Status: **200 OK**
- Response body is your fake users list exactly as you wrote it

### Additional Mock Features

- **Use button**: Click **Use** on a saved mock to automatically fill in the mock URL in the request form
- **Clear state**: For POST/PUT/DELETE mocks that track state, click **Clear state** to reset the mock's stored data
- **Delay**: Set a delay in milliseconds to simulate network latency

### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Mock was saved | Yes | |
| Request to mock URL returns 200 | Yes | |
| Response body matches what you set | Yes | |
| Delay (if set) causes the expected wait | Yes | |

---

## SECTION 20 — GraphQL Request

**What we are testing:** Can the app send a GraphQL query?

**What is GraphQL?** An alternative to REST APIs where you describe exactly what data you want in a special query language.

### Steps

1. Go to **Requests**
2. Method: **POST**
3. URL:
   ```
   https://countries.trevorblades.com/graphql
   ```
4. In the Body section, change **Body mode** to **GraphQL**
5. In the **GraphQL query** box, type:
   ```graphql
   query {
     country(code: "IN") {
       name
       capital
       currency
     }
   }
   ```
6. Leave Variables empty
7. Click **Send**

### GraphQL-specific features

- **Format query** button: auto-formats messy GraphQL into neat indented text
- **Fetch schema** button: loads the API's schema (if the endpoint supports introspection). This lets you click field names in the schema browser to insert them into the query automatically
- **Validation**: the app shows an inline error if your query has a syntax problem before you send

### What you should see

- Status: **200 OK**
- Response:
  ```json
  {
    "data": {
      "country": {
        "name": "India",
        "capital": "New Delhi",
        "currency": "INR"
      }
    }
  }
  ```

### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Status code | 200 | |
| Country name "India" in response | Yes | |
| Capital "New Delhi" in response | Yes | |

---

## SECTION 21 — Response Panel

**What we are testing:** Do all the response panel features work correctly?

After every request, the Response panel shows detailed information. This section covers the full set of tabs and tools.

### Response Tabs

| Tab | What it shows |
|---|---|
| Body | Formatted response text with assertion failures listed at the bottom |
| Tree | Collapsible JSON tree — great for exploring nested objects |
| Headers | All HTTP response headers |
| Raw | The raw unformatted response string |
| Preview | Renders images, HTML, or other media visually |
| Scripts | Output from pre-request and post-response scripts |
| Diff | Side-by-side comparison of the current response vs. a pinned response |

### Pinning a Response for Comparison

1. Send a request and get a response
2. Click **Pin** (bookmark icon) to pin the current response
3. Change something in the request and send it again
4. Click the **Diff** tab — both responses appear side-by-side with differences highlighted

### Searching the Response

1. Use the **Search response** text field (in the response toolbar)
2. Type any text — matching occurrences are highlighted in the Body, Headers, and Raw tabs

### Downloading the Response

1. Click **Download response** to save the response body as a file
2. The file type is auto-detected from the `Content-Type` header

### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Body tab shows formatted response | Yes | |
| Tree tab shows expandable JSON | Yes | |
| Headers tab shows response headers | Yes | |
| Pin works and Diff tab shows differences | Yes | |
| Search highlights matching text | Yes | |
| Download saves the response body | Yes | |

---

## SECTION 22 — Settings

**What we are testing:** Do the global settings work correctly?

### Steps — Test timeout

1. Click **Settings** in the navigation bar
2. Set **Default timeout (seconds)** to `1`
3. Go to Requests
4. URL: `https://httpbin.org/delay/5` (this API deliberately waits 5 seconds)
5. Click **Send**

### What you should see

- After 1 second, the app shows a timeout error message
- The app does not freeze

### Per-request overrides

The **Timeout** and **SSL** settings can also be overridden on each individual request:
- **Timeout (s)** field — in the request line next to the URL
- **Skip SSL** toggle — in the request actions bar (below the form)
- **Proxy** field — in the request actions bar

### Proxy URL

1. In **Settings**, enter a proxy URL in the **Proxy URL** field (e.g., `http://127.0.0.1:8080`)
2. All requests will be routed through the proxy
3. You can also set the proxy per-request from the request form

### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Timeout error appears after ~1 second | Yes | |
| App stays responsive after timeout | Yes | |
| Per-request timeout overrides the global default | Yes | |

---

## SECTION 23 — Multiple Tabs

**What we are testing:** Can the app handle multiple open requests at once?

### Steps

1. Go to **Requests**
2. Open one request: GET `https://jsonplaceholder.typicode.com/posts/1`
3. Click the **New tab** button (+ icon)
4. Open a second request: GET `https://jsonplaceholder.typicode.com/users/1`
5. Send both requests
6. Switch between tabs

### What you should see

- Each tab keeps its own URL, method, and response
- Switching tabs does not mix up the responses

### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Two tabs open independently | Yes | |
| Each tab shows correct response | Yes | |
| Switching tabs works correctly | Yes | |

---

## SECTION 24 — Workspaces

**What we are testing:** Can the app keep separate sets of data in different workspaces?

**What is a Workspace?** Think of it like a separate project folder. Workspace A has its own collections, history, and variables — completely separate from Workspace B.

### Steps

1. Click **Workspace** in the navigation bar
2. In the **Create new workspace** field, type `Test Workspace`
3. Click Create
4. Switch to `Test Workspace`
5. Go to Collections — it should be empty (separate from Default)
6. Go to Variables — also empty
7. Switch back to **Default** workspace
8. Check Collections — your previous saved requests are still there

### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| New workspace created | Yes | |
| New workspace has empty collections | Yes | |
| Default workspace data still intact | Yes | |

---

## SECTION 25 — Environments (Variable Profiles)

**What we are testing:** Can the app save and restore named sets of variables for different environments?

**What is an Environment profile?** A snapshot of your current variables saved under a name (e.g., "Development", "Staging", "Production"). Switch profiles to instantly swap all variable values at once — no need to change each variable one by one.

**Example:** You have a `base_url` variable. In Development it is `https://dev.example.com`, in Production it is `https://api.example.com`. You save two profiles and switch between them with one click.

### Steps — Save a profile

1. In **Variables**, add a variable: `base_url` = `https://dev.example.com`
2. Click **Environments** in the navigation bar
3. In the **Profile name** field, type: `Development`
4. Click **Save current vars as profile**
5. Back in **Variables**, change `base_url` to `https://api.example.com`
6. In **Environments**, type: `Production` and save again

### Steps — Switch profiles

1. In **Environments**, you see both profiles listed
2. Click **Development** to restore all variables to their dev values
3. Click **Production** to switch to prod values

### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Profiles appear in Environments list | Yes | |
| Clicking a profile restores all variable values | Yes | |
| Active profile name is shown | Yes | |

---

## SECTION 26 — Google OAuth

**What we are testing:** Can the app obtain a Google access token using the OAuth PKCE flow and save it as a variable?

**What is OAuth?** A way for you to grant a third-party app (like this tester) access to your Google account without sharing your password.

### Steps

1. Click **Google OAuth** in the navigation bar
2. Fill in your **Client ID** from the Google Cloud Console
3. If you have one, fill in your **Client secret** (optional for PKCE clients)
4. **Scopes** is pre-filled — you can adjust it (e.g., add `https://www.googleapis.com/auth/gmail.readonly`)
5. Note the **Redirect URI** shown — add this URI to the allowed redirect URIs in your Google Cloud Console
6. Click **Sign in with Google**
7. Google's sign-in page opens — log in and grant permission
8. After sign-in, the access token is saved automatically as the variable `{{google_access_token}}`
9. Click **Use access token** to pre-fill a request with `Authorization: Bearer {{google_access_token}}`

### Pass / Fail

| Check | Expected | Pass? |
|---|---|---|
| Sign-in page opens in the current tab | Yes | |
| After sign-in, variable is saved | Yes | |
| `{{google_access_token}}` resolves in requests | Yes | |

---

## Summary Test Results Table

Fill this in as you complete each section:

| # | Feature | Result | Notes |
|---|---|---|---|
| 1 | Basic GET | Pass / Fail | |
| 2 | GET list | Pass / Fail | |
| 3 | POST with body | Pass / Fail | |
| 4 | Query parameters | Pass / Fail | |
| 5 | Custom headers | Pass / Fail | |
| 6A | Bearer auth | Pass / Fail | |
| 6B | Basic auth | Pass / Fail | |
| 6C | API key auth | Pass / Fail | |
| 6D | Folder auth inheritance | Pass / Fail | |
| 7 | PUT request | Pass / Fail | |
| 8 | DELETE request | Pass / Fail | |
| 9 | 404 error handling | Pass / Fail | |
| 10A | Workspace variables | Pass / Fail | |
| 10B | Secret variables | Pass / Fail | |
| 10C | Collection variables | Pass / Fail | |
| 10D | Cookie jar | Pass / Fail | |
| 11A | Save to collections | Pass / Fail | |
| 11B | Collection folders | Pass / Fail | |
| 11C | Folder auth settings | Pass / Fail | |
| 11D | cURL import | Pass / Fail | |
| 11E | Import formats | Pass / Fail | |
| 12 | Request history | Pass / Fail | |
| 13A | Status/body assertions | Pass / Fail | |
| 13B | Header assertion | Pass / Fail | |
| 13C | JSONPath assertions | Pass / Fail | |
| 14 | Captures | Pass / Fail | |
| 15 | Scripts | Pass / Fail | |
| 16 | Code snippet | Pass / Fail | |
| 17 | Collection run | Pass / Fail | |
| 18 | Export / Import | Pass / Fail | |
| 19 | Mock server | Pass / Fail | |
| 20 | GraphQL | Pass / Fail | |
| 21 | Response panel | Pass / Fail | |
| 22 | Settings | Pass / Fail | |
| 23 | Multiple tabs | Pass / Fail | |
| 24 | Workspaces | Pass / Fail | |
| 25 | Environments (profiles) | Pass / Fail | |
| 26 | Google OAuth | Pass / Fail | |

---

## Common Problems and Solutions

| Problem | Likely cause | Solution |
|---|---|---|
| "Invalid URL" error | URL is missing `https://` | Add `https://` at the start |
| Response is empty | Wrong method used | Check if you should use GET not POST |
| 401 Unauthorized | Missing or wrong token | Check the Auth section |
| App timeout | Server is slow or URL is wrong | Increase timeout in Settings |
| Variable not resolved | Variable name is misspelled | Check Variables section spelling |
| Mock returns 404 | Wrong path or method | Check mock path matches your request |
| Script does not run | Syntax error in script | Check the Scripts tab for error messages |
| Capture shows error | Wrong JSON path | Check the path format — use dot notation like `data.token` |
| OAuth redirect fails | Redirect URI not registered | Add the shown Redirect URI to your Google Cloud Console |

---

## APIs Used in This Manual (All Free, No Sign-up)

| API | Base URL | What it does |
|---|---|---|
| JSONPlaceholder | `https://jsonplaceholder.typicode.com` | Fake REST API — posts, users, todos |
| HTTPBin | `https://httpbin.org` | Echoes back your request — great for debugging |
| Countries GraphQL | `https://countries.trevorblades.com/graphql` | Country data via GraphQL |

---

*Manual version 2.0 — covers all 26 major features of Accessible API Tester*
