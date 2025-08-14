> [!IMPORTANT]
> 
> This document covers Transmissions, a feature provided by Spaceport's Launchpad Templating system, and handled client-side by HUD-Core. HUD-Core also provides other functionality, so this handbook is not an exhaustive guide to using HUD-Core, but more specifically on using Transmissions. Additionally, this document should be considered a DRAFT, and some functionality may be missing or incorrect.

# The Launchpad Transmission Handbook

Welcome to the definitive guide for using **Transmissions** in your Spaceport application. This handbook provides a comprehensive overview of the syntax, capabilities, and best practices for leveraging this powerful feature within **Launchpad**, the reactive templating system for Spaceport.

A **Transmission** is a JSON payload returned from a server-side action that instructs the client's browser on how to update the user interface. It allows your backend (Groovy) code to directly and precisely manipulate DOM elements, trigger events, and control browser behavior without requiring a full page reload. This server-driven approach keeps your presentation logic clean and centralized.

There are three primary formats for a transmission, each suited for different use cases:

  * **🗺️ Map Transmission:** The most powerful and flexible format, for performing multiple, complex operations.
  * **⛓️ Array Transmission:** A concise format for chaining a sequence of simple actions or class changes.
  * **📦 Single Value Transmission:** The simplest format, for directly updating an element's content.

## **Rationales and a Core Examples**

**One Rationale:** Why use Transmissions? To eliminate the need for custom JavaScript for common UI interactions. Instead of writing frontend code to handle what happens after a button click, you can define that behavior directly on the server, right next to your business logic. This keeps your templates cleaner and your development faster.

**Core Example:** Here is a simple button that updates itself after being clicked.

```html
<button target="self" on-click=${ _{ ['innerText': 'Confirmed!', '+confirmed': 'it'] } }>
    Confirm
</button>
```

**What's Happening?**

1.  **`on-click`**: The user clicks the button, triggering a server action.
2.  **Server Logic**: The Groovy code `_{ ... }` runs on the server. It doesn't need to perform any complex logic; it just returns a Map Transmission.
3.  **Transmission**: The map `['innerText': 'Confirmed!', '+confirmed': 'it']` is sent back to the browser.
4.  **UI Update**: Launchpad receives the map and follows its instructions:
      * `'innerText': 'Confirmed!'` tells it to change the button's text.
      * `'+confirmed': 'it'` tells it to add the CSS class `confirmed` to the button itself (`it`).
Of course. Here is the markdown for that section.

### **Why Use Server State? The Single Source of Truth**

While Launchpad provides tools for managing state on the client (like `documentData` for optimistic updates), the core strength of the Transmission pattern lies in its ability to rely on **server state**.

**Why is this important?**

  * **Reliability:** The server becomes the "single source of truth." The state of your application isn't just a temporary condition in the user's browser; it's a persistent fact stored on your server (e.g., in a database or session).
  * **Consistency:** The user gets the same experience whether they refresh the page, close their browser and come back, or log in from a different device.
  * **Security:** Sensitive calculations and business logic remain on the server, preventing client-side manipulation.

**Example: A Persistent Counter**

This simple counter's value is stored in the user's session on the server. Every click updates the true state, and the server simply tells the client what the new value is.

```groovy
<%
    // Define a local variable, bound to the session by Launchpad when used in conjunction with HUD-Core.
    def counter = 0;

    // Closure to increment the counter
    def increment = {
        counter++
        return counter + ' hot cross buns' // Return the new value directly
    }

    // Closure to decrement the counter
    def decrement = {
        counter--
        return counter + ' hot cross buns' // Ultimately returned by the transmission
    }
%>

<div class="counter-widget">
    <button on-click=${ _{ decrement() } } target="#count-display">-</button>
    <span id="count-display">${ counter } hot cross buns</span>
    <button on-click=${ _{ increment() } } target="#count-display">+</button>
</div>
```

In this example, clicking "+" or "-" runs the corresponding Groovy closure on the server. The closure modifies `counter`, a local variable to the session, and then returns the new integer value. This **Single Value Transmission** is received by the client, and Launchpad updates the `innerHTML` of the `<span id="count-display">` to show the new, authoritative count from the server.

-----

## **Available `on-*` Events**

Launchpad listens for a wide range of standard browser DOM events. You can attach a server action to any of these events by creating an attribute with an `on-` prefix (e.g., `on-click`, `on-submit`). When the event occurs on that element, it will trigger a call to the server and process the returned transmission.

#### **Mouse Events**

  * `on-click`, `on-dblclick`, `on-mousedown`, `on-mouseup`, `on-mouseover`, `on-mouseout`, `on-mouseenter`, `on-mouseleave`, `on-mousemove`, `on-wheel`, `on-contextmenu`

#### **Keyboard Events**

  * `on-keydown`, `on-keyup`, `on-keypress`

#### **Form & Input Events**

  * `on-submit`, `on-change`, `on-input`, `on-select`, `on-focus`, `on-blur`, `on-focusin`, `on-focusout`, `on-formblur` (custom)

#### **Drag & Drop Events**

  * `on-dragenter`, `on-dragleave`, `on-drop`

#### **Touch Events**

  * `on-touchstart`, `on-touchmove`, `on-touchend`, `on-touchcancel`

#### **Lifecycle Events**

  * `on-load`, `on-beforeunload`

-----

## **Data Sent to the Server**

When a Launchpad event is triggered, a rich payload of contextual data is automatically collected from the client and sent to your server-side Groovy closure. This data is available in the `t` object within your closure (e.g., `_{ t -> ... }`). This allows your server code to make decisions based on the state of the UI, the user's input, and the specifics of the event itself.

| Category | Property | Description |
| :--- | :--- | :--- |
| **Element Value** | `value` | The primary value of the element. This is intelligently determined: it can be an `<input>`'s text, a checkbox's state, a file's content as Base64, or the trimmed `innerHTML` of a standard element. |
| **Element Info** | `elementId`, `tagName`, `classList`, `innerText`, `textContent` | Core properties of the `activeTarget` element (see `source` attribute below). |
| **Event Info** | `key`, `keyCode`, `shiftKey`, `ctrlKey`, `altKey`, `metaKey`, `repeat` | Details for keyboard events. |
| | `clientX`, `clientY`, `pageX`, `pageY`, `button`, `buttons`, `offsetX`, `offsetY`, `movementX`, `movementY` | Details for mouse events. |
| **Form Data** | `[input-name]` | If the element is inside a `<form>`, all named inputs from that form are automatically included by their `name` attribute. Launchpad correctly handles text fields, textareas, checkboxes, radio buttons, select lists (single and multiple), and file inputs. |
| **Custom Data** | `[data-attribute]` | All `data-*` attributes on the element are sent as top-level properties in the `t` object (e.g., `data-user-id="123"` becomes `t.userId`). |
| **URL Data** | `[query-param]` | All query parameters from the current page's URL are included as top-level properties. |
| **Included Data** | `[storage-key]` | You can use the `include` attribute on an element to explicitly send specific `localStorage` (`*key`) or `sessionStorage` (`~key`) values. You can also include standard element attributes by name (e.g., `include="id, *theme"`). |

-----

## **The `source` Attribute: Pinpointing Event Origins**

The `source` attribute gives you precise control over **which element's data is sent to the server**, which is especially useful for event delegation.

Imagine you have a list where each item should be clickable. Instead of putting an `on-click` on every single `<li>`, you can put one on the parent `<ul>`. But how do you know which `<li>` was clicked? The `source` attribute solves this.

| `source` Value | Behavior | Use Case |
| :--- | :--- | :--- |
| **(not set)** | By default, the data comes from the `event.target` (the actual element clicked). | Simple cases where the clickable element is the one with the `on-*` listener. |
| **CSS Selector** | The `on-*` listener is on a container, but the data payload is gathered from the child element that matches the selector. | A `ul` with `on-click` and `source="li"`. When you click an `li`, the server receives the `value`, `data-*` attributes, etc., of that specific `li`. |
| **`strict`** | The event will only fire if the element clicked (`event.target`) is the exact same element that has the `on-*` listener (`event.currentTarget`). Clicks on child elements are ignored. | Preventing actions from firing when a user clicks on an icon or `<strong>` tag inside a button. |
| **`auto`** | Explicitly sets the default behavior where the `event.target` is the source of the data. | Can be used to clarify intent, but is rarely needed as it's the default behavior. |

-----

## **The `target` Attribute**

The `target` attribute is fundamental to Launchpad, as it dictates **which element in the DOM receives the update** from a server transmission. It provides a powerful and declarative way to manipulate elements without writing custom Javascript to find them.

When an event fires, Launchpad looks for the `target` attribute by first checking the element itself, and then walking up the DOM tree to see if an ancestor has one.

| Target Value | Description | Additional Attributes | Example (HTML) |
| :--- | :--- | :--- | :--- |
| **`self`** | The update is applied to the element that the `on-*` event is on. | (none) | `<button target="self" on-click=${...}>Update Me</button>` |
| **`none`** | Explicitly specifies that there is no target for the update. | (none) | `<button target="none" on-click=${...}>Fire and Forget</button>` |
| **`parent`** | Targets the immediate parent element. | (none) | `<div> <button target="parent" on-click=${...}>Update Div</button> </div>` |
| **`grandparent`** | Targets the parent of the parent element. | (none) | `<body> <div> <button target="grandparent" on-click=${...}>Update Body</button> </div> </body>` |
| **`next`** / **`previous`** | Targets the next or previous sibling element at the same level. | (none) | `<div id="a"></div> <button target="previous" on-click=${...}></button>` |
| **`first`** / **`last`** | Targets the first or last child element inside the current element. | (none) | `<div on-click=${...} target="first"> <p>Target Me</p> <p>Not Me</p> </div>` |
| **`append`** / **`prepend`** | **Inserts a new element** as the last/first child of the current element and targets it. | `element-type` (optional, defaults to `div`) | `<ul on-click=${...} target="append" element-type="li">Add Item</ul>` |
| **`after`** / **`before`** | **Inserts a new element** after/before the current element and targets it. | `element-type` (optional, defaults to `div`) | `<div on-click=${...} target="after">Insert New Div After</div>` |
| **`nth-child`** | Targets a child of the current element by its index (0-based). | `child-index="n"` | `<div on-click=${...} target="nth-child" child-index="1"> <p>0</p> <p>Target Me</p> </div>` |
| **`nth-sibling`** | Targets a sibling of the current element by its index (0-based). | `sibling-index="n"` | `<p>0</p> <button on-click=${...} target="nth-sibling" sibling-index="0"></button>` |
| **`ancestor-tag`** | Finds the closest ancestor element with the specified tag name. | `ancestor-tag="tagname"` | `<form> <button on-click=${...} target="ancestor-tag" ancestor-tag="form">Update Form</button> </form>` |
| **`ancestor-class`**| Finds the closest ancestor element with the specified CSS class. | `ancestor-class="name"` | `<div class="card"> <button on-click=${...} target="ancestor-class" ancestor-class="card">Update Card</button> </div>`|
| **`descendant-tag`**| Finds the first descendant element with the specified tag name. | `descendant-tag="tagname"` | `<div on-click=${...} target="descendant-tag" descendant-tag="span"> <p> <span>Target Me</span> </p> </div>` |
| **`descendant-class`**| Finds the first descendant element with the specified CSS class. | `descendant-class="name"` | `<div on-click=${...} target="descendant-class" descendant-class="item"> <p class="item">Target Me</p> </div>` |
| `> selector` | Uses a CSS selector to find a descendant within the current element. | (none) | `<div on-click=${...} target="> .item-details"> <p class="item-details"></p> </div>` |
| `selector` | Any other string is treated as a global CSS selector for the entire document. Ideal for IDs. | (none) | `<button on-click=${...} target="#main-content">Update Main</button>` |

#### **The Special Case: `target="outer"`**

The `outer` value is a special modifier. It targets the element itself (just like `self`), but it changes **how** the update is applied for single value transmissions.

  * **Standard Target (`self`, `#id`, etc.):** The transmission updates the `innerHTML` of the target.
  * **`target="outer"`:** The transmission replaces the **entire target element** with the new content (by setting its `outerHTML`).

-----

## **Transmission Formats**

### 🗺️ The Map Transmission (`[key: value]`)

A Map transmission is a Groovy map (`[key: value]`) where each key-value pair represents a specific instruction for the client. This is the most common and versatile format.

#### **Content & Attribute Manipulation**

| Prefix / Key | Description | Example (Groovy) |
| :--- | :--- | :--- |
| **(none)** | Sets a standard HTML attribute on the target element. | `['disabled': true, 'title': 'Processing...']` |
| **`#`** | Sets a `data-*` attribute. The `#` is replaced with `data-`. | `['#userId': 123, '#role': 'admin']` |
| **`value`** | Sets the `.value` property of the target (e.g., for `<input>`). | `['value': 'Initial text']` |
| **`innerHTML`** | Replaces the entire inner HTML content of the target. | `['innerHTML': '<strong>Update Complete!</strong>']` |
| **`outerHTML`** | Replaces the entire target element with the provided HTML string. | `['outerHTML': '<div class="alert">Done.</div>']` |
| **`innerText`** | Sets the rendered text content of the target. | `['innerText': 'Are you sure?']` |
| **`append`** | Inserts HTML at the very end of the target element's children. | `['append': '<li>New Item</li>']` |
| **`prepend`** | Inserts HTML at the very beginning of the target element's children. | `['prepend': '<li>First Item</li>']` |
| **`insertAfter`** | Inserts HTML immediately after the target element. | `['insertAfter': '<hr>']` |
| **`insertBefore`** | Inserts HTML immediately before the target element. | `['insertBefore': '<h2>Section Start</h2>']` |

#### **Styling & Classes**

| Prefix | Description | Example (Groovy) |
| :--- | :--- | :--- |
| **`&`** | Sets an inline CSS style property on the target element. | `['&backgroundColor': 'yellow', '&fontWeight': 'bold']` |
| **`+`** | Adds a CSS class to the target element. | `['+is-valid': 'it', '+highlight': 'this']` |
| **`-`** | Removes a CSS class from the target element. | `['-is-loading': 'it']` |

#### **Element & Form Actions (`@` prefix)**

| Action Key | Description | Value Type(s) | Example (Groovy) |
| :--- | :--- | :--- | :--- |
| **`@alert`** | Shows a browser `alert()` dialog. | `String` | `['@alert': 'Record saved successfully!']` |
| **`@log`, `@table`** | Logs data to the browser's developer console. | `any` | `['@log': 'Debug info here...', '@table': someDataObject]` |
| **`@click`** | Programmatically triggers a click event. | `null`, `'this'`, `'it'`, `'source'` | `['@click': 'it']` |
| **`@focus`, `@blur`** | Sets or removes focus from an element. | `null`, `'this'`, `'it'`, `'source'` | `['@focus': 'source']` |
| **`@select`, `@end`** | Selects text or moves the cursor to the end of an input. | `null`, `'this'`, `'it'`, `'source'` | `['@select': 'this']` |
| **`@submit`, `@reset`** | Submits or resets a form. | `null`, `'this'`, `'it'`, `'source'` | `['@submit': '#main-form']` |
| **`@show`, `@hide`** | Shows or hides an element (by toggling `display: none`). | `null`, `'this'`, `'it'`, `'source'` | `['@hide': 'it']` |
| **`@open`, `@close`** | Opens/closes a `<details>` or `<dialog>`, or a window. | `String (URL)`, `null`, `'this'`, `'it'`, `'source'` | `['@open': '#my-modal']` |
| **`@remove`** | Removes an element from the DOM. | `null`, `'this'`, `'it'`, `'source'` | `['@remove': '.item-to-delete']` |
| **`@clear`** | Clears an element's `value` or `innerHTML`. | `null`, `'this'`, `'it'`, `'source'` | `['@clear': '#search-input']` |
| **`@download`** | Triggers a file download. | `String (URL)` | `['@download': '/path/to/report.pdf']` |

#### Action Targets: `this`, `it`, and `source`
When you specify an action in a Map Transmission, you can control which element the action applies to.

* **Default (no value or `null`)**: The action applies to the **`payloadTarget`**, which is the element determined by the main `target` attribute.
* `'this'`: The action applies to the **`event.target`**, which is the specific element the user actually clicked or interacted with.
* `'it'`: The action applies to the **`event.currentTarget`**, which is the element that has the `on-*` event listener attached to it.
* `'source'`: The action applies to the **`activeTarget`**, which is the element that provided the data payload (as determined by the `source` attribute).

#### **Browser & Storage Control**

| Prefix / Key | Description | Value Type(s) | Example (Groovy) |
| :--- | :--- | :--- | :--- |
| **`?`** | Sets a URL query parameter without reloading the page. | `String` | `['?page': 2, '?sort': 'asc']` |
| **`*`** | Sets a key-value pair in the browser's `localStorage`. | `String` | `['*theme': 'dark']` |
| **`~`** | Sets a key-value pair in the browser's `sessionStorage`. | `String` | `['~sessionToken': 'xyz123']` |
| **`@redirect`** | Navigates the browser to a new URL. | `String (URL)` | `['@redirect': '/dashboard']` |
| **`@reload`** | Reloads the current page. | `null` | `['@reload': null]` |
| **`@back`, `@forward`** | Navigates back or forward in the browser's history. | `null` | `['@back': null]` |
| **`@print`** | Opens the browser's print dialog. | `null` | `['@print': null]` |

-----

### ⛓️ The Array Transmission (`[...]`)

An Array transmission is a shorthand for applying a sequence of simple, parameter-less instructions to the target element. It's perfect for managing classes and chaining basic actions.

#### **Class Manipulation**

| Prefix | Behavior | Example (Groovy) |
| :--- | :--- | :--- |
| **(none)** | **Toggles** a CSS class. If it exists, it's removed; if not, it's added. | `['selected', 'active']` |
| **`+`** | **Adds** a CSS class. | `['+active', '+processing']` |
| **`-`** | **Removes** a CSS class. | `['-active', '-processing']` |

#### **Chaining Actions (`@` prefix)**

You can trigger a sequence of actions on the target element.

  * **Supported Actions:** `@click`, `@focus`, `@blur`, `@select`, `@submit`, `@reset`, `@remove`, `@show`, `@hide`, `@scroll-to`, `@clear`, `@reload`, `@back`, `@forward`, `@print`.

**Example:**

```groovy
// On form submission success:
// 1. Remove the 'processing' class from the form.
// 2. Add the 'completed' class to the form.
// 3. Clear the text inside the '#response-message' element.
// 4. Toggle the 'visible' class on it.
return ['-processing', '+completed', '@clear', 'visible']
```

-----

### 📦 The Single Value Transmission (`"string"`)

This is the simplest transmission format. When your server action returns a single, non-JSON value (like a plain string), it's used to directly update the content of the target element.

  * **Default Behavior:** Launchpad intelligently places the content in the `.value` property (for inputs) or the `innerHTML` (for other elements).
  * **`target="outer"` Override:** If the triggering element has `target="outer"`, the **entire target element is replaced** by the returned string.

<!-- end list -->

```groovy
// Groovy action to get a status message
return "Last saved: ${new Date().format('h:mm:ss a')}"
```

-----

## **Examples in a Launchpad Template**

Here’s how you can put these concepts together in a real Launchpad template. The server logic is defined directly within the `on-*` attributes using a Groovy closure syntax: `${ _{ t -> ... } }`. The `t` parameter holds all the data sent from the client.

### **Example 1: Simple Action**

This example uses an Array Transmission to perform a single, parameter-less action. No data is needed from the client, and the action (`@print`) affects the whole browser window.

```html
<button on-click="${ _{ [ '@print' ] }}">
    Print Poster
</button>
```

### **Example 2: Form Submission and Data Handling**

This example shows a form that, upon submission, sends all its input values to the server. The Groovy closure accesses this data via the `t` object, performs a database operation, and then returns a transmission to reload the page.

```groovy
<% // Define the server-side logic in a closure
   def editGuestbook = { t ->
       // Access form inputs from the 't' object
       gb.info.name = t.name.clean()
       gb.info.open = t.getBool('open')
       gb.save()

       // Return a transmission to reload the page
       [ '@reload' ]
   }
%>

<form on-submit=${ _{ t -> editGuestbook(t) }}>
    <input name='name' value="${ gb.info.name }">
    <input type='checkbox' name='open' ${ gb.info.open ? 'checked' : '' }>
    <button type='submit'>Update</button>
</form>
```

### **Example 3: Inline Action with Contextual Data**

Here, we're iterating through a list of participants. The `on-click` action needs to know *which* participant to remove. We pass the unique `participant.cookie` from the current loop iteration directly into the server-side `removeParticipant` method. The transmission then targets the parent `<div>` and removes it from the page, providing instant feedback.

```html
<div class='participant-entry'>
    <strong>${ participant.name }</strong>

    <span target='parent' style='cursor: pointer;'
          on-click=${ _{ gb.removeParticipant(participant.cookie); [ '@remove' ] }}>
        🗑️
    </span>
</div>
```


## **UI/UX Pattern Examples**

### **Pattern 1: Edit-in-Place**

This pattern allows users to click an "Edit" button to turn a piece of text into an input field, and then save their changes. It makes great use of `target="outer"` to swap between a "view" state and an "edit" state.

```groovy
<%
    // Assume 'user' is a document object with a 'name' property
    def userName = user.name

    // Closure to show the editing UI
    def showEditUI = {
        // Use a Groovy multi-line string to define the HTML for the edit state
        return """
        <div id="user-profile" target="outer">
            <input type="text" name="newName" value="${userName.escape()}">
            <button on-click=${ _{ t -> saveUserName(t.newName) }}>Save</button>
            <button on-click=${ _{ showViewUI() }}>Cancel</button>
        </div>
        """
    }

    // Closure to save the new name and show the view UI
    def saveUserName = { newName ->
        user.name = newName
        user.save()
        // After saving, return the view state UI
        return showViewUI()
    }

    // Closure to show the viewing UI
    def showViewUI = {
        return """
        <div id="user-profile" target="outer">
            <span>${user.name.escape()}</span>
            <button on-click=${ _{ showEditUI() }}>Edit</button>
        </div>
        """
    }
%>

<!-- Initial state of the component -->
<div id="user-profile" target="outer">
    <span>${userName.escape()}</span>
    <button on-click=${ _{ showEditUI() }}>Edit</button>
</div>
```

### **Pattern 2: "Load More" Button**

This pattern is used for paginating through a long list of items without full page reloads. It uses the `append` transmission to add new items to the list and can hide itself when there's no more data.

```groovy
<%
    // Server-side function to fetch a "page" of items
    def getItems = { page = 0, perPage = 5 ->
        // In a real app, this would be a database query
        def allItems = (1..20).collect { "Item #$it" }
        def start = page * perPage
        def end = Math.min(start + perPage, allItems.size())
        if (start >= allItems.size()) return [:]
        return [
            items: allItems[start..<end],
            hasMore: end < allItems.size()
        ]
    }

    // Closure for the button's on-click event
    def loadMoreItems = { t ->
        // Get the next page number from the button's data attribute
        def nextPage = t.page.toInteger()
        def results = getItems(nextPage)

        // Build the HTML for the new items
        def newItemsHtml = results.items.collect { "<li>${it}</li>" }.join('')

        // Build the transmission
        def transmission = [
            // Use 'append' on the <ul> to add the new items
            append: newItemsHtml,
            // Update the button's data-page attribute for the next click
            '#page': nextPage + 1
        ]

        // If there are no more items, add an instruction to hide the button
        if (!results.hasMore) {
            transmission['@hide'] = 'it' // 'it' refers to the button itself
        }

        return transmission
    }
%>

<ul id="item-list">
    <% getItems().items.each { item -> %>
        <li>${item}</li>
    <% } %>
</ul>

<button target="#item-list"
        data-page="1"
        on-click=${ _{ t -> loadMoreItems(t) }}>
    Load More
</button>
```
