> [!IMPORTANT]
> 
> This document covers Transmissions, a feature provided by Spaceport's Launchpad Templating system–handled client-side by HUD-Core. HUD-Core also provides other functionality aside from transmissions, so this handbook is not an exhaustive guide to using HUD-Core, but more specifically on using Transmissions with Launchpad, and a few patterns around the Transmission concept.

# The Launchpad Transmission Handbook

Welcome to the definitive guide for using **Transmissions** in your Spaceport application. This handbook provides a comprehensive overview of the syntax, capabilities, and best practices for leveraging this powerful feature within **Launchpad**, the reactive templating system for Spaceport.

A **Transmission** is a JSON payload returned from a server-side action that instructs the client's browser on how to update the user interface. It allows your backend (Groovy) code to directly and precisely manipulate DOM elements, trigger events, and control browser behavior without requiring a full page reload. This server-driven approach keeps your presentation logic clean and centralized.

Transmissions come in two forms:

  * **📦 Single Value:** Return a string to replace an element's content — the simplest case.
  * **🎛️ Bundled:** Return a Map or Array to bundle multiple operations into one response — set attributes, toggle classes, trigger actions, update content, and target other elements on the page.

## **Some Important Context**

You may find yourself here without an idea of what Launchpad and Spaceport are. Spaceport is a full-stack web application framework that uses Groovy in combination with other standard web technologies. Find more information in the Spaceport Manual [https://spaceport.com.co/docs/](https://spaceport.com.co/docs/).

Ready to hop right in to the Spaceport ecosystem? Check out [Port Mercury](https://github.com/spaceport-dev/port-mercury/), a starter kit for Spaceport that uses Launchpad, Transmissions, and other features that Spaceport offers–or check out [Guestbook.ing](https://github.com/aufdemrand/guestbook.ing/), a small real-world application built with Spaceport that contains plenty of comments, hints, and Spaceport features. 

This guide for Transmissions will serve as an onboarding for Launchpad Transmissions, but will also be useful as a handbook as reference for Launchpad Transmission syntax as you build your application.

## **Rationales and a Core Examples**

**One Rationale:** 

Why use Transmissions? To eliminate the need for custom JavaScript for common UI interactions. Instead of writing frontend code to handle what happens after a button click, you can define that behavior directly on the server, right next to your business logic. This keeps your templates cleaner and your development faster.

**Core Example:** Here is a simple button that updates itself after being clicked.

```html
<button target="self" on-click=${ _{ ['innerText': 'Confirmed!', '+confirmed': 'it'] }}>
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

**Another Rationale: Server State–The Single Source of Truth**

While Launchpad provides tools for managing state on the client (like `documentData` for optimistic updates), one of the core strengths of the Transmission pattern lies in its ability to rely on **server state**.

**Why is this important?**

  * **Reliability:** The server becomes the "single source of truth." The state of your application isn't just a temporary condition in the user's browser; it's a persistent fact stored on your server (e.g., in a database or session).
  * **Consistency:** The user gets the same experience whether they refresh the page, close their browser and come back, or log in from a different device.
  * **Security:** Sensitive calculations and business logic remain on the server, preventing client-side manipulation.

**Example: A Persistent Counter**

This simple counter's value is stored in the user's session on the server. Every click updates the true state, and the server simply tells the client what the new value is.

```groovy
<%
    // Define a local variable, bound to the session by Launchpad when used in
    // conjunction with HUD-Core, or any other variable in any scope necessary.
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
    <button on-click=${ _{ decrement() }} target="#count-display">-</button>
    <span id="count-display">${ counter } hot cross buns</span>
    <button on-click=${ _{ increment() }} target="#count-display">+</button>
</div>
```

In this example, clicking "+" or "-" runs the corresponding Groovy closure on the server. The closure modifies `counter`, a local variable to the session, and then returns the new integer value. This **Single Value Transmission** is received by the client, and Launchpad updates the `innerHTML` of the `<span id="count-display">` to show the new, authoritative count from the server.

-----

## **Available `on-*` Events**

Launchpad listens for a wide range of standard browser DOM events. You can attach a server action to any of these events by creating an attribute with an `on-` prefix (e.g., `on-click`, `on-submit`). When the event occurs on that element, it will trigger a call to the server and process the returned transmission.

> [!NOTE]
> Notice that the syntax for a Launchpad Server Event differs from a standard client-side inline event with a dash (-) in its attribute name. This allows for leverage of both server-side and client-side inline events when necessary.

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

  * `on-load`, `on-beforeunload`, `on-nudge` (custom)

-----

## **Data Sent to the Server**

When a Launchpad event is triggered, a rich payload of contextual data is automatically collected from the client and sent to your server-side Groovy closure. This data is available in the `t` object within your closure (e.g., `_{ t -> ... }`). This allows your server code to make decisions based on the state of the UI, the user's input, and the specifics of the event itself.

| Category | Property | Description |
| :--- | :--- | :--- |
| **Element Value** | `value` | The primary value of the element. This is intelligently determined: it can be an `<input>`'s text, a checkbox's state, a file's content as Base64, or the trimmed `innerHTML` of a standard element. |
| **Element Info** | `elementId`, `tagName`, `classList`, `innerText`, `textContent` | Core properties of the `activeTarget` element (see `source` attribute below). |
| **Event Info** | `key`, `keyCode`, `shiftKey`, `ctrlKey`, `altKey`, `metaKey`, `repeat` | Details for keyboard events. Note: shiftKey, ctrlKey, etc. appear only if `true`. |
| | `clientX`, `clientY`, `pageX`, `pageY`, `button`, `buttons`, `offsetX`, `offsetY`, `movementX`, `movementY` | Details for mouse events. |
| **Form Data** | `[input-name]` | If the element is inside a `<form>`, all named inputs from that form are automatically included by their `name` attribute. Launchpad correctly handles text fields, textareas, checkboxes, radio buttons, select lists (single and multiple), and file inputs. |
| **Custom Data** | `[data-attribute]` | All `data-*` attributes on the element are sent as top-level properties in the `t` object (e.g., `data-user-id="123"` becomes `t.userId`). |
| **URL Data** | `[query-param]` | All query parameters from the current page's URL are included as top-level properties. |
| **Included Data** | `[storage-key]` | You can use the `include` attribute on an element to explicitly send specific `localStorage` (`*key`) or `sessionStorage` (`~key`) values. You can also include standard element attributes by name (e.g., `include="id, *theme"`). |

### **Working with the `t` Object on the Server**

The `t` object gives your server-side Groovy code direct access to all the data sent from the client. However, since this data comes from HTML attributes and form fields, it often arrives as strings. To make working with this data easier and safer, the `t` object is equipped with several helper methods to reliably convert these values into the data types you need.

| Method | Description | Example Usage |
| :--- | :--- | :--- |
| `t.getString('key')` | Safely converts the value of the given key to a `String`. | `def name = t.getString('username')` |
| `t.getBool('key')` | Coerces the value into a `boolean`. Handles `"true"`, `"on"`, `"yes"`, and checkbox states. Returns `false` for other values. | `def isAdmin = t.getBool('isAdmin')` |
| `t.getNumber('key')` | Intelligently converts the value to a `Long` or `Double`, depending on whether it contains a decimal point. Returns `0L` on failure. | `def price = t.getNumber('itemPrice')` |
| `t.getInteger('key')` | Coerces the value into an `Integer`. Returns `0` on failure. | `def quantity = t.getInteger('quantity')` |
| `t.getList('key')` | Converts a value into a `List`. It can parse comma-separated strings, JSON arrays, or wrap a single item in a list. | `def tags = t.getList('tags')` |

**Example: Using Helpers in a Server Action**

```groovy
<%
def processOrder = { t ->
    // Direct access might give you a string "5"
    def quantityStr = t.quantity 
    
    // Using a helper ensures you get an Integer for calculations
    def quantity = t.getInteger('quantity') // Safely returns 5 (Integer)

    // A checkbox might send "on" or just exist if checked
    def isPriority = t.getBool('priorityShipping') // Safely returns true or false

    // A data attribute might be a string "19.99"
    def price = t.getNumber('price') // Safely returns 19.99 (Double)

    if (isPriority && quantity > 0) {
        // ... process order with correct data types
    }

    // Return a bundled transmission that updates the button AND the status display
    return [
        'disabled': true,
        '+confirmed': 'it',
        '#order-status': [
            '+visible',
            ['innerHTML': "Order placed! ${quantity} items, \$${price * quantity} total"]
        ]
    ]
}
%>

<form on-submit=${ _{ t -> processOrder(t) }} target='button'>
    <input name="quantity" value="5" data-price="19.99">
    <input type="checkbox" name="priorityShipping" checked>
    <button type="submit">Submit</button>
    <div id="order-status"></div>
</form>
```

-----

## **The `source` Attribute: Pinpointing Event Origins**

The `source` attribute gives you precise control over **which element's data is sent to the server**, which is especially useful for event delegation.

Imagine you have a list where each item should be clickable. Instead of putting an `on-click` on every single `<li>`, you can put one on the parent `<ul>`. But how do you know which `<li>` was clicked? The `source` attribute solves this.

| `source` Value | Behavior | Use Case |
| :--- | :--- | :--- |
| **(not set)** | By default, the data comes from the `event.target` (the actual element clicked). | Simple cases where the clickable element is the one with the `on-*` listener. |
| **CSS Selector** | The `on-*` listener is on a container, but the data payload is gathered from the element that matches the selector from the source element. | A `ul` with `on-click` and `source="li"`. When you click an `li`, the server receives the `value`, `data-*` attributes, etc., of that specific `li`. |
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
| **`nextnext`** / **`previousprevious`** | Targets the next or previous sibling element's next or previous sibling element at the same level. | (none) | `<div id="a"></div> <img> <button target="previousprevious" on-click=${...}></button>` |
| **`first`** / **`last`** | Targets the first or last child element inside the current element. | (none) | `<div on-click=${...} target="first"> <p>Target Me</p> <p>Not Me</p> </div>` |
| **`append`** / **`prepend`** | **Inserts a new element** as the last/first child of the current element and targets it. | `wrapper` (optional, defaults to `div`) | `<ul on-click=${...} target="append" wrapper="li">Add Item</ul>` |
| **`after`** / **`before`** | **Inserts a new element** after/before the current element and targets it. | `wrapper` (optional, defaults to `div`) | `<div on-click=${...} target="after">Insert New Div After</div>` |
| **`nth-child`** | Targets a child of the current element by its index (0-based). | `index="n"` | `<div on-click=${...} target="nth-child" index="1"> <p>0</p> <p>Target Me</p> </div>` |
| **`nth-sibling`** | Targets a sibling of the current element by its index (0-based). | `index="n"` | `<p>0</p> <button on-click=${...} target="nth-sibling" index="0"></button>` |
| `> selector` | Uses a CSS selector to find a descendant within the current element. | (none) | `<div on-click=${...} target="> .item-details"> <p class="item-details"></p> </div>` |
| `< selector` | Uses a CSS selector to find an ancestor of the current element. | (none) | `<section> ... <div on-click=${...} target="< section"> <p class="item-details"></p> </div> ... </section>` |
| `selector` | Any other string is treated as a global CSS selector for the entire document. Ideal for IDs, or advanced selectors. | (none) | `<button on-click=${...} target="#main-content">Update Main</button>` |

#### **The Special Case: `target="outer"`**

The `outer` value is a special modifier. It targets the element itself (just like `self`), but it changes **how** the update is applied for single value transmissions.

  * **Standard Target (`self`, `#id`, etc.):** The transmission updates the `innerHTML` of the target.
  * **`target="outer"`:** The transmission replaces the **entire target element** with the new content (by setting its `outerHTML`).

-----

## **Transmission Formats**

### 📦 Single Value Transmissions

The simplest transmission. When your server action returns a single value (a string or number), it directly updates the content of the target element.

  * **Default Behavior:** Launchpad intelligently places the content in the `.value` property (for inputs) or the `innerHTML` (for other elements).
  * **`target="outer"` Override:** If the triggering element has `target="outer"`, the **entire target element is replaced** by the returned string.

```groovy
// Returns a string — the target element's content is replaced
return "Last saved: ${new Date().format('h:mm:ss a')}"
```

This is all you need for straightforward content updates. For anything more — toggling classes, setting attributes, triggering actions, or updating multiple elements — you'll use bundled transmissions.

-----

### 🎛️ Bundled Transmissions

When you need more than a content replacement, return a **Map** or **Array** from your server action. Each entry in the map or array is an operation that Launchpad applies to the target element. Maps and arrays compose together freely — arrays can contain maps, and maps can contain arrays — so you're never locked into one format.

#### **Using Maps**

A Map transmission is a Groovy map (`[key: value]`) where each key-value pair is an instruction. The key's prefix determines the operation:

**Content & Attributes**

| Prefix / Key | Description | Example (Groovy) |
| :--- | :--- | :--- |
| **(none)** | Sets a standard HTML attribute on the target element. | `['disabled': true, 'title': 'Processing...']` |
| **`*`** | Sets a `data-*` attribute. The `*` in the key is replaced with `data-`. | `['*user-id': 123, '*role': 'admin']` |
| **`value`** | Sets the `.value` property of the target (e.g., for `<input>`). | `['value': 'Initial text']` |
| **`innerHTML`** | Replaces the entire inner HTML content of the target. | `['innerHTML': '<strong>Update Complete!</strong>']` |
| **`outerHTML`** | Replaces the entire target element with the provided HTML string. | `['outerHTML': '<div class="alert">Done.</div>']` |
| **`innerText`** | Sets the rendered text content of the target. | `['innerText': 'Are you sure?']` |
| **`append`** | Inserts HTML at the very end of the target element's children. | `['append': '<li>New Item</li>']` |
| **`prepend`** | Inserts HTML at the very beginning of the target element's children. | `['prepend': '<li>First Item</li>']` |
| **`insertAfter`** | Inserts HTML immediately after the target element. | `['insertAfter': '<hr>']` |
| **`insertBefore`** | Inserts HTML immediately before the target element. | `['insertBefore': '<h2>Section Start</h2>']` |

**Styling & Classes**

| Prefix | Description | Example (Groovy) |
| :--- | :--- | :--- |
| **`&`** | Sets an inline CSS style property on the target element. | `['&backgroundColor': 'yellow', '&fontWeight': 'bold']` |
| **`+`** | Adds a CSS class to the target element. | `['+is-valid': 'it', '+highlight': 'this']` |
| **`-`** | Removes a CSS class from the target element. | `['-is-loading': 'it']` |

**Element & Form Actions (`@` prefix)**

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
| **`@nudge`** | Triggers a nudge event. | `null`, `'this'`, `'it'`, `'source'` | `['@nudge': 'it']` |

**Browser & Storage**

| Prefix / Key | Description | Value Type(s) | Example (Groovy) |
| :--- | :--- | :--- | :--- |
| **`?`** | Sets a URL query parameter without reloading the page. | `String` | `['?page': 2, '?sort': 'asc']` |
| **`~`** | Sets a key-value pair in the browser's `localStorage`. | `String` | `['~theme': 'dark']` |
| **`~~`** | Sets a key-value pair in the browser's `sessionStorage`. | `String` | `['~~sessionToken': 'xyz123']` |
| **`@redirect`** | Navigates the browser to a new URL. | `String (URL)` | `['@redirect': '/dashboard']` |
| **`@reload`** | Reloads the current page. | `null` | `['@reload': null]` |
| **`@back`, `@forward`** | Navigates back or forward in the browser's history. | `null` | `['@back': null]` |
| **`@print`** | Opens the browser's print dialog. | `null` | `['@print': null]` |

#### Action Targets: `this`, `it`, and `source`

Actions and class operations accept a value that controls which element they apply to:

* **Default (no value or `null`)**: Applies to the **payload target** — the element determined by the `target` attribute.
* `'this'`: Applies to the **`event.target`** — the specific element the user actually clicked or interacted with.
* `'it'`: Applies to the **`event.currentTarget`** — the element that has the `on-*` event listener attached to it.
* `'source'`: Applies to the **`activeTarget`** — the element that provided the data payload (as determined by the `source` attribute).

#### **Using Arrays**

An Array transmission applies a sequence of instructions to the target element. Each string item is an action or class operation:

| Prefix | Behavior | Example (Groovy) |
| :--- | :--- | :--- |
| **`@`** | Triggers an action (`@click`, `@focus`, `@blur`, `@select`, `@submit`, `@reset`, `@remove`, `@show`, `@hide`, `@scroll-to`, `@clear`, `@reload`, `@back`, `@forward`, `@print`). | `['@focus', '@select']` |
| **`+`** | **Adds** a CSS class. | `['+active', '+processing']` |
| **`-`** | **Removes** a CSS class. | `['-active', '-processing']` |
| **(none)** | **Toggles** a CSS class. | `['selected', 'active']` |

```groovy
// Remove 'processing', add 'completed', clear the target, toggle 'visible'
return ['-processing', '+completed', '@clear', 'visible']
```

Arrays can also contain **Map items** for keyed operations — content, attributes, styles — without switching to a full map format:

```groovy
// Actions and classes as strings, content and styles as an embedded map
return ['+active', '@focus', '-loading', ['innerHTML': '<p>Done!</p>', '&color': 'green']]
```

This is cleaner than using a map when most of your instructions are actions or classes:

```groovy
// Map format — values are wasted on the actions/classes
return ['+active': '', '@focus': '', '-loading': '', 'innerHTML': '<p>Done!</p>']

// Array with embedded map — same result, no wasted values
return ['+active', '@focus', '-loading', ['innerHTML': '<p>Done!</p>']]
```

-----

#### **Targeting Other Elements**

So far, every operation has applied to the target element — the one determined by the `target` attribute. But a bundled transmission can also update **other elements** across the page.

**Selector Keys with Scalar Values**

In a map, certain key prefixes target elements by selector and set their `innerHTML`:

| Key Format | Behavior | Example |
| :--- | :--- | :--- |
| `#id` | Updates the element with a specific ID. | `['#status': 'Saved!']` |
| `> selector` | Finds a descendant of the source element. | `['> .details': '<p>Updated details</p>']` |

These work alongside regular instructions in the same map:

```groovy
return [
    'disabled': true,          // instruction on the target (button)
    '+loading': 'it',          // class on the button
    '#order-status': 'Saving…' // innerHTML on a different element
]
```

**Selector Keys with Full Instruction Sets**

When a map entry's value is an **Array or Map** (instead of a scalar), the key is treated as a selector and the value becomes a full set of operations applied to that element.

**The Rule:** Scalar value → operates on the target. Array or Map value → operates on the selector.

```groovy
// Scalar value — sets innerHTML of #status
return ['#status': 'Saved!']

// Array value — applies a full instruction set to #status
return ['#status': ['-loading', '+saved', ['innerText': 'Saved!', '&color': 'green']]]
```

Selector keys support all the same values as the `target` attribute — named targets (`parent`, `self`, `next`, `grandparent`, etc.) resolved relative to the event source, plus any CSS selector (`#id`, `.class`, `div > span`, etc.).

**Example: Multi-Element Update**

A single server action that updates the button, its parent, a status panel, and a notification tray:

```groovy
return [
    'disabled': true,                            // target: set attribute
    '+confirmed': 'it',                          // target: add class
    'parent': ['-loading', '+done'],             // parent: remove/add classes
    '#status-panel': ['innerHTML': '<p>Order confirmed!</p>', '&opacity': '1'],
    '#notification-tray': ['append': '<div class="toast">Order #1042 placed</div>']
]
```

Scalar entries (`disabled`, `+confirmed`) apply to the target element. Array/Map entries (`parent`, `#status-panel`, `#notification-tray`) resolve the key as a selector and apply the nested instructions to that element.

**Bundled Entries in Arrays**

Arrays can also carry bundled entries — just include a Map item where the keys are selectors:

```groovy
return [
    '+active',                                        // target: add class
    '@focus',                                         // target: focus
    ['#tray': ['append': '<span>New item</span>']],   // #tray: append content
    ['parent': ['-loading']]                          // parent: remove class
]
```

String items apply to the target. Map items are processed as instructions — and if a map entry's value is an array or map, it's bundled just like in a top-level map.

-----

## **Examples in a Launchpad Template**

Here’s how you can put these concepts together in a real Launchpad template. The server logic is defined directly within the `on-*` attributes using a Groovy closure syntax: `${ _{ t -> ... } }`. The `t` parameter holds all the data sent from the client.

### **Example 1: Simple Action**

This example uses an array transmission to perform a single, parameter-less action. No data is needed from the client, and the action (`@print`) affects the whole browser window.

```html
<button on-click="${ _{ [ '@print' ] }}">
    Print Poster
</button>
```

> [!NOTE]
> Notice that the transmission is alone inside the server action. By default, Groovy returns the last value, so a return keyword is optional when sending the transmission back to the client.

### **Example 2: Form Submission and Data Handling**

This example shows a form that, upon submission, sends all its input values to the server. The Groovy closure accesses this data via the `t` object, performs a database operation, and then returns a transmission to reload the page.

```groovy
<%
   // Define the server-side logic in a closure
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

> [!NOTE]
> The `t` parameter is optional if you don't require any client-side context aside from the firing of the event itself. Including the parameter, however, unlocks all of the contextual data that HUD-Core will send for your server-side logic to assess.

### **Example 3: Inline Action with Contextual Data**

Here, we're iterating through a list of participants. The `on-click` action needs to know *which* participant to remove. We pass the unique `participant.cookie` from the current loop iteration directly into the server-side `removeParticipant` method. The transmission removes the entry from the page and updates the participant count — all in one response.

```html
<h3>Participants (<span id="participant-count">${ participants.size() }</span>)</h3>

<div class='participant-entry'>
    <strong>${ participant.name }</strong>

    <span target='parent' style='cursor: pointer;'
          on-click=${ _{ 
              gb.removeParticipant(participant.cookie)
              return [
                  '@remove',
                  ['#participant-count': [
                      'innerText': gb.fetchParticipants().size()
                  ]]
              ]
          }}>
        🗑️
    </span>
</div>
```

The array transmission removes the parent element (`@remove`), then the embedded map targets `#participant-count` to update the displayed count. Previously, you'd need a separate mechanism to keep the count in sync.


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

This pattern paginates through a list without full page reloads. Using a bundled transmission, one response appends items to the list, updates the button's state, and shows a count — all targeting different elements.

```groovy
<%
    def getItems = { page = 0, perPage = 5 ->
        def allItems = (1..20).collect { "Item #$it" }
        def start = page * perPage
        def end = Math.min(start + perPage, allItems.size())
        if (start >= allItems.size()) return [items: [], hasMore: false, total: allItems.size()]
        return [items: allItems[start..<end], hasMore: end < allItems.size(), total: allItems.size()]
    }

    def loadMoreItems = { t ->
        def nextPage = t.getInteger('page')
        def results = getItems(nextPage)
        def newItemsHtml = results.items.collect { "<li>${it}</li>" }.join('')

        // One response targets the list, the button, and the count
        def transmission = [
            '#item-list': ['append': newItemsHtml],
            '*page': nextPage + 1,
            '#item-count': "Showing ${Math.min((nextPage + 1) * 5, results.total)} of ${results.total}"
        ]

        if (!results.hasMore) {
            transmission['@hide'] = 'it'
        }

        return transmission
    }
%>

<p id="item-count">Showing 5 of 20</p>

<ul id="item-list">
    <% getItems().items.each { item -> %>
        <li>${item}</li>
    <% } %>
</ul>

<button target="self"
        data-page="1"
        on-click=${ _{ t -> loadMoreItems(t) }}>
    Load More
</button>
```

Notice the button targets `self` now — it doesn't need to be aimed at the list because the bundled entry `'#item-list': ['append': ...]` handles that. The button manages its own state (`*page`, `@hide`) while the list and count are updated by selector.

### **Pattern 3: Form Validation with Per-Field Errors**

Bundled transmissions make server-side form validation clean — one response can mark individual fields as invalid, show per-field error messages, and update a summary, all without any client-side JavaScript.

```groovy
<%
    def validateSignup = { t ->
        def errors = [:]
        if (!t.getString('email')?.contains('@')) errors.email = 'Please enter a valid email'
        if (t.getString('password')?.length() < 8) errors.password = 'Must be at least 8 characters'
        if (t.getString('password') != t.getString('confirm')) errors.confirm = 'Passwords do not match'

        if (errors) {
            // Build a bundled transmission targeting each error span
            def transmission = ['-loading': 'it']
            errors.each { field, message ->
                // Target the error span next to each input and the input itself
                transmission["#${field}-error"] = message
                transmission["#${field}-input"] = ['+invalid', ['*error': message]]
            }
            transmission['#form-status'] = [
                '+has-errors',
                ['innerHTML': "${errors.size()} field(s) need attention"]
            ]
            return transmission
        }

        // Success — create the account and show confirmation
        createAccount(t.getString('email'), t.getString('password'))
        return [
            '@redirect': '/welcome'
        ]
    }
%>

<form on-submit=${ _{ t -> validateSignup(t) }} target="self">
    <div>
        <input id="email-input" name="email" placeholder="Email">
        <span id="email-error" class="error"></span>
    </div>
    <div>
        <input id="password-input" name="password" type="password" placeholder="Password">
        <span id="password-error" class="error"></span>
    </div>
    <div>
        <input id="confirm-input" name="confirm" type="password" placeholder="Confirm">
        <span id="confirm-error" class="error"></span>
    </div>
    <div id="form-status"></div>
    <button type="submit">Sign Up</button>
</form>
```

Each field gets its error message set via `#field-error` selector, and the input itself gets an `invalid` class and a data attribute via bundled instructions. Previously, you'd need to pick a single target for the transmission and handle the rest with client-side code.

### **Pattern 4: Coordinated Multi-Element Update**

This pattern shows how a single form submission can update multiple regions of the page at once — the form itself, a results panel, and a status bar — using a bundled transmission.

```groovy
<%
    def submitSearch = { t ->
        def query = t.getString('query')
        def results = searchService.find(query)
        def resultsHtml = results.collect { """
            <div class="result">
                <strong>${ it.title }</strong>
                <p>${ it.snippet }</p>
            </div>
        """ }.join('')

        return [
            // Target element (the form): disable while showing results
            '@clear': 'source',

            // Bundled: update the results panel with full instruction set
            '#results-panel': [
                '+has-results',
                '-empty',
                ['innerHTML': resultsHtml, '*query': query]
            ],

            // Bundled: update the status bar
            '#status-bar': ['innerText': "${results.size()} results for '${query}'"]
        ]
    }
%>

<form on-submit=${ _{ t -> submitSearch(t) }} target="self">
    <input name="query" placeholder="Search...">
    <button type="submit">Search</button>
</form>

<div id="results-panel" class="empty"></div>
<div id="status-bar"></div>
```

**What's Happening?**

1. `'@clear': 'source'` is a scalar value — it clears the form's input (the source element).
2. `'#results-panel': ['+has-results', '-empty', ['innerHTML': ..., '*query': ...]]` has an Array value — so `#results-panel` is resolved as a selector. The array is applied as a sequence: add a class, remove a class, then set innerHTML and a data attribute via the embedded map.
3. `'#status-bar': ['innerText': "..."]` has a Map value — resolved as a selector, then the inner map sets the text content.

All three updates happen from a single server response — no extra requests, no client-side JavaScript.
