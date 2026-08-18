// HUD-CORE v1.3.0

// This file enabled web-HUD features for Launchpad, the reative
// templating engine for Spaceport. Include this file in your
// HTML parts or vessels to enable the HUD features.

// The functions in this file should not need to be called by the
// user. They are automatically activated and called by Spaceport.

// For more information on HUD-CORE's features, see the documentation:
// https://spaceport.com.co/docs/launchpad#hud-core


//
//
// WebSocket Connection
//
//


// Sends data to the server using the WebSocket connection
// Note: ASYNC, cannot guarantee order of execution, so plan accordingly.
function sendData(id, data) {

    const payload = {
        "handler-id": id,
        ...data
    }

    // Allow for multiple attempts to send data, the connection
    // may not be open yet, or may be in a reconnecting state.
    function trySend() {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(payload))
            console.log('Sent data: ' + data)
        } else {
            setTimeout(trySend, 25) // Retry after 25ms
            console.log('Retrying to send data: ' + data)
        }
    }

    trySend() // Initial attempt
}


//
//
// HUD Initialization
//
//


// Cleans up Server Elements, their window declaration, also listeners that were registered
// with .listen(), and run a user-defined deconstructed event (if necessary)
function cleanupLaunchpadElement(element) {
    const elementId = element.getAttribute('element-id');
    
    // Look up the global component instance (e.g., window.element_456)
    const componentInstance = window[`element_${elementId}`];

    if (componentInstance) {
        if (componentInstance._listeners && Array.isArray(componentInstance._listeners)) {
            componentInstance._listeners.forEach(listener => {
                // Use the stored references to remove the listeners
                element.removeEventListener(listener.type, listener.handler, listener.options);
            });
            // Clear the array to free up memory
            componentInstance._listeners.length = 0;
        }
        if (componentInstance.deconstructed) {
            try {
                // Developers use this for timers, window events, or other "crazy" tasks.
                componentInstance.deconstructed(componentInstance);
            } catch (e) {
                console.error(`Error in deconstructed() hook for element ${elementId}:`, e);
            }
        }
        delete window[`element_${elementId}`];
    }
}


document.addEventListener('DOMContentLoaded', function() {

    // Scan DOM for 'comment' nodes and parse for document data
    scanForComments(document)

    // Watch for mutations
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {

            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(function(node) {

                    // Node type 8 is a comment, which CDATA is wrapped in with most modern browsers
                    if (node.nodeType === Node.COMMENT_NODE) {
                        // Incoming cDATA will be applied to the documentData object
                        parseForDocumentData(node)
                    }

                    // Node type 1 is an element
                    if (node.nodeType === Node.ELEMENT_NODE) {

                        // Repositioned by a morph pass, not new. It is already
                        // wired up, and the setup below would double its listeners.
                        if (node.hudMoved) {
                            delete node.hudMoved
                            return
                        }

                        //
                        // ELEMENT (PARENT)
                        //

                        // Check if node has a 'mutated' property
                        if (node.hasOwnProperty('mutated')) {
                            // If it does, then it has already been processed
                            try { node.mutated(node) } catch (e) { console.error(e) }
                        }

                        // Add Event Listeners for new elements
                        for (let i = 0; i < builtInEvents.length; i++) {
                            let attr = builtInEvents[i]
                            if (node.hasAttribute(attr)) {
                                let eventName = attr.substring(3) // remove the 'on-' prefix
                                setupOnAttribute(eventName, node)
                            }
                        }
                        shimOnNudge(node)

                        // Evaluate any scripts
                        if (node.tagName === 'SCRIPT') {
                            console.log(`Evaluating script: ${ node.innerHTML }`)
                            window.eval(node.innerHTML)
                        }

                        if (node.hasAttribute('href')) {
                            setupHREF(node)
                        }

                        //
                        // CHILDREN
                        //

                        // Do the same for all children
                        if (node.querySelectorAll) {
                            node.querySelectorAll('*').forEach(function(child) {

                                // Check if node has a 'mutated' property
                                if (child.hasOwnProperty('mutated')) {
                                    // If it does, then it has already been processed
                                    try { child.mutated(node) } catch (e) { console.error(e) }
                                }

                                // Evaluate incoming scripts
                                if (child.tagName === 'SCRIPT') {
                                    console.log(`Evaluating script: ${ child.innerHTML }`)
                                    window.eval(child.innerHTML)
                                }

                                // Add Event Listeners for new elements
                                for (let i = 0; i < builtInEvents.length; i++) {
                                    let attr = builtInEvents[i]
                                    if (child.hasAttribute(attr)) {
                                        let eventName = attr.substring(3) // remove the 'on-' prefix
                                        setupOnAttribute(eventName, child)
                                    }
                                }
                                shimOnNudge(child)

                                if (child.hasAttribute('href')) {
                                    setupHREF(child)
                                }

                                if (child.hasAttribute('popovertarget')) {
                                    const target = child.getAttribute('popovertarget')
                                    const popover = document.querySelector('#' + target)
                                    if (popover) {
                                        popover.togglePopover()
                                    }
                                }

                            })
                        }

                        // Get all comments inside children nodes
                        function findCommentNodes(element) {
                            let comments = [];
                            for (let i = 0; i < element.childNodes.length; i++) {
                                let child = element.childNodes[i];
                                if (child.nodeType === Node.COMMENT_NODE) {
                                    comments.push(child);
                                }
                                // Recursively look for comments in child nodes
                                comments = comments.concat(findCommentNodes(child));
                            }
                            return comments;
                        }

                        findCommentNodes(node).forEach(function(comment) {
                            parseForDocumentData(comment)
                        })

                        // TODO: Handles custom elements, AKA HUD-ELEMENTS
                    }

                })

                mutation.removedNodes.forEach(function(node) {

                    // Node type 1 is an element
                    if (node.nodeType === Node.ELEMENT_NODE) {

                        // The removal half of a morph pass repositioning this node.
                        // It is still on the page, so nothing is torn down here.
                        // The matching addition record clears the flag.
                        if (node.hudMoved) { return }

                        // Check if the removed node itself is a Launchpad Element
                        if (node.hasAttribute('element-id')) {
                             cleanupLaunchpadElement(node);
                        }
                        
                        // Check for any Launchpad Elements nested inside the removed node
                        if (node.querySelectorAll) {
                            node.querySelectorAll('[element-id]').forEach(function(childElement) {
                                 cleanupLaunchpadElement(childElement);
                            });
                        }

                        // Removed
                        if (node.hasOwnProperty('removed')) {
                            try { node.removed(node) } catch (e) { console.error(e) }
                        }

                        let registeredURLs = []
                        if (node.hasAttribute('lp-uuid')) {
                            registeredURLs.push(node.getAttribute('lp-uuid'))
                        }

                        if (node.querySelectorAll) {
                            node.querySelectorAll('*').forEach(function(child) {
                                if (child.hasAttribute('lp-uuid')) {
                                    registeredURLs.push(child.getAttribute('lp-uuid'))
                                }
                            })
                        }

                        if (registeredURLs.length > 0) {
                            const url = '/!/lp/bind/u/'
                            const fetchOptions = {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({ uuids: registeredURLs })
                            }
                            // console.log(node)
                            // console.log(`UNREGISTERING -> ${registeredURLs}`)
                            fetch(url, fetchOptions) // Courtesy unloading helps performance on the server-side
                        }

                        // Auto-remove any event listeners.
                        if (node.eventListeners) {
                            node.eventListeners.forEach(listener => {
                                node.removeEventListener(listener.type, listener.callback);
                            });
                        }
                    }
                })

            }

            if (mutation.type === 'attributes') {
                // console.log('Attribute changed: ' + mutation.attributeName)
                // get changes
                const targetNode = mutation.target;

                // Call the attributeChanged function if it exists on the target node
                if (targetNode.hasOwnProperty('attributeChanged')) {
                    try {
                        targetNode.attributeChanged(targetNode, mutation.attributeName, mutation.oldValue, targetNode.getAttribute(mutation.attributeName));
                    } catch (e) {
                        console.error(e);
                    }
                }

            }
        })

        // document.querySelector(focusedElementSelector)?.focus()
    })

    // Set up all elements with ON-[EVENT] attributes
    builtInEvents.forEach(attribute => {
        const eventName = attribute.substring(3) // remove the 'on-' prefix
        document.querySelectorAll("[" + attribute + "]").forEach(element => {
            console.log(`ATTACHED -> HUD-*:${eventName.toUpperCase()}: ${element.tagName}`)
            setupOnAttribute(eventName, element)
            if (attribute === 'on-load') {
                let e = new Event('load')
                element.dispatchEvent(e)
            }
        })
    })

    // Shim inline onnudge attributes on existing elements
    document.querySelectorAll('[onnudge]').forEach(shimOnNudge)

    // Elements that have a HREF attribute will be automatically registered for click events
    // and will navigate the page to the specified URL.
    document.querySelectorAll('[href]').forEach(element => {
        setupHREF(element)
    })

    // Configuration of the observer
    const config = { attributes: true, childList: true, subtree: true, attributeOldValue: true }

    // Observe the entire document for mutations, apply appropriate changes
    observer.observe(document.body, config)

    // Morph reactive updates instead of replacing them
    installReactionMorph()

})


//
//
// Server Events
//
//


// Elements with an ON-[EVENT] attribute will be automatically registered for that EVENT
// to call the endpoint specified in the attribute, and return the payload to the TARGET.

const builtInEvents = [
    // Enable or disable the default events as needed to tweak performance.
    'on-click',
    'on-dblclick',
    'on-mouseover',
    'on-mouseout',
    'on-mouseenter',
    'on-mouseleave',
    'on-mousedown',
    'on-mouseup',
    'on-mousemove',
    'on-keydown',
    'on-keyup',
    'on-keypress',
    'on-change',
    'on-input',
    'on-submit',
    'on-focus',
    'on-focusout',
    'on-focusin',
    'on-blur',
    'on-drag',
    'on-dragend',
    'on-dragenter',
    'on-dragleave',
    'on-dragover',
    'on-dragstart',
    'on-drop',
    // 'on-scroll',
    'on-wheel',
    'on-touchstart',
    'on-touchmove',
    'on-touchend',
    'on-touchcancel',
    'on-load',
    // 'on-unload',
    // 'on-error',
    // 'on-resize',
    'on-select',
    'on-contextmenu',
    'on-beforeunload',
    'on-formblur',
    'on-nudge'
]


// Shims inline onnudge attributes so they work like native inline event handlers.
// Browsers only auto-wire on* attributes for built-in events, so custom events
// like 'nudge' need manual wiring.
function shimOnNudge(element) {
    if (element.hasAttribute('onnudge') && !element._nudgeShimmed) {
        const handler = element.getAttribute('onnudge')
        element.addEventListener('nudge', new Function('event', handler))
        element._nudgeShimmed = true
    }
}


// Resolves a target string to a DOM element relative to a reference element.
// Used by getTargetElement() for target-attribute resolution and by
// applyInstructions() for bundled transmission selector keys.
function resolveTarget(targetString, element, wrapper = 'div') {
    switch (targetString) {
        case 'self':
        case 'outer':
            return element

        case 'none':
            return null

        case 'parent':
            return element.parentElement
        case 'grandparent':
            return element.parentElement?.parentElement
        case 'next':
            return element.nextElementSibling
        case 'previous':
            return element.previousElementSibling
        case 'nextnext':
            return element.nextElementSibling?.nextElementSibling
        case 'previousprevious':
            return element.previousElementSibling?.previousElementSibling
        case 'first':
            return element.firstElementChild
        case 'last':
            return element.lastElementChild

        case 'after':
            element.insertAdjacentHTML('afterend', `<${wrapper}></${wrapper}>`)
            return element.nextElementSibling
        case 'before':
            element.insertAdjacentHTML('beforebegin', `<${wrapper}></${wrapper}>`)
            return element.previousElementSibling
        case 'append':
            element.insertAdjacentHTML('beforeend', `<${wrapper}></${wrapper}>`)
            return element.lastElementChild
        case 'prepend':
            element.insertAdjacentHTML('afterbegin', `<${wrapper}></${wrapper}>`)
            return element.firstElementChild

        case 'nth-sibling':
            return element.parentNode?.children[parseInt(element.getAttribute('index'), 10)] || null
        case 'nth-child':
            return element.children[parseInt(element.getAttribute('index'), 10)] || null
        case 'nth-parent':
            return element.parentElement?.parentElement?.children[parseInt(element.getAttribute('index'), 10)] || null

        default:
            try {
                if (targetString.startsWith('>')) {
                    return element.querySelector(targetString.substring(1))
                }
                if (targetString.startsWith('<')) {
                    return element.closest(targetString.substring(1))
                }
                return document.querySelector(targetString) || null
            } catch (e) {
                return null
            }
    }
}

// Resolves the this/it/source context selector to a DOM element.
// Used by applyAction() to determine which element an action targets.
//   'this'   -> event.target (the element that fired the event)
//   'it'     -> event.currentTarget (the element with the listener)
//   'source' -> activeTarget (the element providing form data)
//   default  -> the transmission's payload target
function resolveContextTarget(value, target, context) {
    if (value === 'this') return context.event.target
    if (value === 'it') return context.event.currentTarget
    if (value === 'source') return context.activeTarget
    return target
}

// Executes an @-prefixed action instruction.
//   action: the action name without '@' prefix (e.g., 'click', 'focus')
//   value:  the action's value — context selector ('this','it','source'), data (URL, message), or null
//   target: the default target element (payloadTarget)
//   context: { event, activeTarget }
function applyAction(action, value, target, context) {
    const el = resolveContextTarget(value, target, context)

    switch (action) {
        case 'click': el.click(); break
        case 'focus': el.focus(); break
        case 'blur': el.blur(); break
        case 'submit': el.submit(); break
        case 'reset': el.reset(); break
        case 'remove': el.remove(); break

        case 'select':
            if (el.select) { el.select() }
            else {
                let selection = window.getSelection()
                let range = document.createRange()
                range.selectNodeContents(el)
                selection.removeAllRanges()
                selection.addRange(range)
            }
            break

        case 'end':
            if (el.tagName === 'INPUT') {
                el.selectionStart = el.value.length
            } else {
                let range = document.createRange()
                let sel = window.getSelection()
                range.setStart(el, 1)
                range.collapse(true)
                sel.removeAllRanges()
                sel.addRange(range)
            }
            break

        case 'show':
            if (el.show) { el.show() }
            else {
                el.style.display = el.getAttribute('x-display')
                el.removeAttribute('x-display')
            }
            break

        case 'hide':
            if (el.hide) { el.hide() }
            else {
                el.setAttribute('x-display', el.style.display)
                el.style.display = 'none'
            }
            break

        case 'open':
            if (typeof value === 'string' && value.startsWith('http')) { window.open(value); break }
            if (el.tagName === 'DETAILS') { el.setAttribute('open', 'true') }
            else if (el.tagName === 'DIALOG') { el.show() }
            else { el.open() }
            break

        case 'close':
            if (value === 'window') { window.close(); break }
            if (el.tagName === 'DETAILS') { el.removeAttribute('open') }
            else if (el.tagName === 'DIALOG') { el.close() }
            else { el.closest('dialog')?.close() }
            break

        case 'clear':
            if (el.value) { el.value = '' }
            else { el.innerHTML = '' }
            break

        case 'nudge':
            el.dispatchEvent(new CustomEvent('nudge', { bubbles: true }))
            break

        case 'scroll-to': target.scrollTo(value); break
        case 'scroll-by': target.scrollBy(value); break
        case 'scroll-into-view': target.scrollIntoView(value); break

        case 'reload': window.location.reload(); break
        case 'redirect': if (value) window.location.href = value; break
        case 'back': window.history.back(); break
        case 'forward': window.history.forward(); break
        case 'replace': if (value) window.history.replaceState(null, null, value); break
        case 'print': window.print(); break

        case 'download':
            if (value) {
                const a = document.createElement('a')
                a.href = value; a.download = ''; a.click()
            }
            break

        case 'alert': alert(value); break
        case 'log': console.log(value); break
        case 'table': console.table(value); break
    }
}

// Recursively applies a transmission payload to a target DOM element.
//   target:  the DOM element to operate on
//   payload: string (set content), array (sequential instructions), or object (keyed instructions)
//   context: { event, activeTarget, sourceTarget, outerMode }
//     - event:        the original DOM event
//     - activeTarget: the element providing form data ('source' context)
//     - sourceTarget: the original event source element (for resolving named targets in bundled entries)
//     - outerMode:    if true, string payloads replace outerHTML instead of innerHTML (top-level only)
function applyInstructions(target, payload, context) {

    // STRING PAYLOAD: set content directly
    if (typeof payload === 'string' || (payload != null && !(payload instanceof Object) && !Array.isArray(payload))) {
        if (target == null) return
        if (context.outerMode) {
            morphOuter(target, payload)
        } else if (target.value) {
            target.value = payload
        } else if (target.setValue) {
            target.setValue(payload)
        } else {
            morphInner(target, payload)
        }
        return
    }

    if (payload == null) return

    // ARRAY PAYLOAD: sequential instructions (strings for actions/classes, objects processed recursively)
    if (Array.isArray(payload)) {
        payload.forEach(item => {
            if (typeof item === 'object' && item !== null) {
                // Maps-in-lists: process object as keyed instructions on same target
                applyInstructions(target, item, { ...context, outerMode: false })
            } else if (typeof item === 'string') {
                if (item.startsWith('@')) {
                    applyAction(item.substring(1), null, target, context)
                } else if (item.startsWith('-')) {
                    target.classList.remove(item.substring(1))
                } else if (item.startsWith('+')) {
                    target.classList.add(item.substring(1))
                } else {
                    target.classList.toggle(item)
                }
            }
        })
        return
    }

    // OBJECT PAYLOAD: keyed instructions
    for (let key in payload) {
        const value = payload[key]

        // Actions — checked first since @actions can take object values (scroll options, console data)
        if (key.startsWith('@')) { applyAction(key.substring(1), value, target, context) }

        // BUNDLED DETECTION: if value is array or non-null object, key is a selector
        else if (value !== null && typeof value === 'object') {
            const resolved = resolveTarget(key, context.sourceTarget)
            if (resolved) {
                applyInstructions(resolved, value, { ...context, outerMode: false })
            }
        }

        // Content operations
        else if (key === 'value') { target.value = value }
        else if (key === 'innerHTML') { morphInner(target, value) }
        else if (key === 'outerHTML') { morphOuter(target, value) }
        else if (key === 'innerText') { target.innerText = value }
        else if (key === 'append') { target.insertAdjacentHTML('beforeend', value) }
        else if (key === 'prepend') { target.insertAdjacentHTML('afterbegin', value) }
        else if (key.toLowerCase() === 'insertbefore') { target.insertAdjacentHTML('beforebegin', value) }
        else if (key.toLowerCase() === 'insertafter') { target.insertAdjacentHTML('afterend', value) }

        // URL query string
        else if (key.startsWith('?')) {
            const url = new URL(window.location.href)
            url.searchParams.set(key.substring(1), value)
            window.history.pushState({}, '', url)
        }

        // Data attributes
        else if (key.startsWith('*')) { target.dataset[key.substring(1)] = value }

        // Inline styles
        else if (key.startsWith('&')) { target.style[key.substring(1)] = value }

        // Session storage
        else if (key.startsWith('~~')) { sessionStorage.setItem(key.substring(2), value) }

        // Local storage
        else if (key.startsWith('~')) { localStorage.setItem(key.substring(1), value) }

        // Class add
        else if (key.startsWith('+')) {
            resolveContextTarget(value, target, context).classList.add(key.substring(1))
        }

        // Class remove
        else if (key.startsWith('-')) {
            resolveContextTarget(value, target, context).classList.remove(key.substring(1))
        }

        // Element by ID — innerHTML shorthand
        else if (key.startsWith('#')) {
            const el = document.getElementById(key.substring(1))
            if (el) morphInner(el, value)
        }

        // Descendant selector — innerHTML shorthand
        else if (key.startsWith('>')) {
            const el = context.activeTarget.querySelector(key.substring(1))
            if (el) morphInner(el, value)
        }

        // Default: set as HTML attribute (null removes it)
        else if (target) {
            if (value == null) { target.removeAttribute(key) }
            else { target.setAttribute(key, value) }
        }
    }
}

//
//
// Targeted DOM Morphing
//
//


// Applies incoming HTML by updating the live DOM in place instead of replacing
// it. Assigning a payload to innerHTML destroys and rebuilds every node in the
// subtree, including the ones that did not change, which loses focus, selection,
// scroll position and open dialog state, and churns every Launchpad binding
// underneath. The functions below write only the nodes that actually differ.
// Note: set window.HUD_MORPH = false to go back to replacing.


// Attributes hud-core sets itself. The server never sends them, so they are not
// stripped from a node that survives a pass.
const HUD_RUNTIME_ATTRIBUTES = new Set(['loading', 'fatal-error', 'x-display', 'lp-uuid'])


// The comments Launchpad delimits a reactive block with.
const CHUNK_MARKER = /^\s*(START_CHUNK|END_CHUNK)@/


function morphEnabled() {
    return window.HUD_MORPH !== false
}


// Per-pass bookkeeping. Orphaned bindings are collected rather than released one
// at a time, so a pass costs one round-trip instead of one per node.
function newMorphPass() {
    return { staleUUIDs: new Set(), changedComments: [] }
}


// Releases the bindings this pass orphaned, and re-reads any CDATA comment whose
// value was edited in place.
function finishMorphPass(pass) {

    // A surviving node adopts the uuid the server minted on this render, leaving
    // the one it used to carry registered with nothing pointing at it. The
    // MutationObserver never saw the node leave, so it cannot release it.
    if (pass.staleUUIDs.size > 0) {
        fetch('/!/lp/bind/u/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uuids: Array.from(pass.staleUUIDs) })
        })
    }

    // The observer watches childList and attributes, not characterData.
    pass.changedComments.forEach(comment => parseForDocumentData(comment))
}


// A node's identity across renders. element-id and lp-uuid are NOT used for
// this: Launchpad mints fresh ones every render, so they identify a render.
function morphKey(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return null
    return node.getAttribute('key') || node.id || null
}


// Whether an existing node can be updated into the incoming one, rather than
// being discarded and replaced.
function isSoftMatch(oldNode, newNode) {
    if (!oldNode || !newNode) return false
    if (oldNode.nodeType !== newNode.nodeType) return false

    if (oldNode.nodeType === Node.ELEMENT_NODE) {
        if (oldNode.tagName !== newNode.tagName) return false
        if (oldNode.namespaceURI !== newNode.namespaceURI) return false

        const oldKey = morphKey(oldNode)
        const newKey = morphKey(newNode)
        if (oldKey || newKey) return oldKey === newKey
        return true
    }

    // A START marker must never be updated into an END marker, or the block's
    // boundaries move.
    if (oldNode.nodeType === Node.COMMENT_NODE) {
        const oldMarker = CHUNK_MARKER.exec(oldNode.nodeValue)
        const newMarker = CHUNK_MARKER.exec(newNode.nodeValue)
        if (oldMarker || newMarker) {
            return !!oldMarker && !!newMarker && oldMarker[1] === newMarker[1]
        }
    }

    return true
}


// Parses HTML in the right parsing context, so a fragment that is only legal
// inside a particular parent (<tr>, <option>, an SVG child) is not dropped.
function parseInContext(html, contextNode) {
    const context = contextNode.nodeType === Node.ELEMENT_NODE ? contextNode : contextNode.parentElement
    const doc = contextNode.ownerDocument || document

    let container
    if (context && context.namespaceURI && context.namespaceURI !== 'http://www.w3.org/1999/xhtml') {
        container = doc.createElementNS(context.namespaceURI, context.localName)
    } else {
        try {
            container = doc.createElement(context ? context.tagName : 'div')
        } catch (e) {
            container = doc.createElement('div')
        }
    }

    container.innerHTML = html == null ? '' : String(html)
    return container
}


// Brings a surviving element's attributes in line with the incoming one.
function syncAttributes(oldEl, newEl, pass) {

    for (let i = 0; i < newEl.attributes.length; i++) {
        const name = newEl.attributes[i].name
        const value = newEl.attributes[i].value
        if (oldEl.getAttribute(name) === value) continue

        // A new element-id means a new Server Element instance. Retire the old
        // one first, or its listeners and deconstructed() hook never run.
        if (name === 'element-id' && oldEl.hasAttribute('element-id')) {
            cleanupLaunchpadElement(oldEl)
        }

        // Wiring happens when the observer sees a node arrive, and a surviving
        // node never arrives, so an attribute gained here is wired on the spot.
        // Each of these setup calls is idempotent.
        const gained = !oldEl.hasAttribute(name)

        oldEl.setAttribute(name, value)

        if (gained) {
            if (builtInEvents.indexOf(name) !== -1) { setupOnAttribute(name.substring(3), oldEl) }
            else if (name === 'href') { setupHREF(oldEl) }
            else if (name === 'onnudge') { shimOnNudge(oldEl) }
        }
    }

    // Backwards: removeAttribute() mutates the live NamedNodeMap being walked.
    for (let i = oldEl.attributes.length - 1; i >= 0; i--) {
        const name = oldEl.attributes[i].name
        if (newEl.hasAttribute(name)) continue
        if (HUD_RUNTIME_ATTRIBUTES.has(name)) continue

        if (name === 'element-id') { cleanupLaunchpadElement(oldEl) }

        oldEl.removeAttribute(name)
    }
}


// Re-derives lp-uuid, which setupOnAttribute sets from the on-* endpoint rather
// than the server sending it, and releases the uuid it replaces.
function syncBindingUUID(oldEl, pass) {
    let endpoint = null

    for (let i = 0; i < builtInEvents.length; i++) {
        if (oldEl.hasAttribute(builtInEvents[i])) {
            endpoint = oldEl.getAttribute(builtInEvents[i])
            break
        }
    }

    if (endpoint == null) return

    const uuid = endpoint.replace('/!/lp/bind?uuid=', '')
    const previous = oldEl.getAttribute('lp-uuid')
    if (previous === uuid) return

    if (previous) pass.staleUUIDs.add(previous)
    oldEl.setAttribute('lp-uuid', uuid)
}


// Syncs the live value of a form control, which its attributes do not carry.
// Anything the user is currently editing is left alone; everything else is set
// to what the server sent.
function syncLiveProperties(oldEl, newEl) {
    if (oldEl === document.activeElement) return

    if (oldEl.tagName === 'INPUT') {
        if (oldEl.type === 'checkbox' || oldEl.type === 'radio') {
            const checked = newEl.hasAttribute('checked')
            if (oldEl.checked !== checked) oldEl.checked = checked
        } else if (newEl.hasAttribute('value')) {
            const value = newEl.getAttribute('value')
            if (oldEl.value !== value) oldEl.value = value
        }
    } else if (oldEl.tagName === 'TEXTAREA') {
        if (oldEl.value !== newEl.textContent) oldEl.value = newEl.textContent
    } else if (oldEl.tagName === 'OPTION') {
        const selected = newEl.hasAttribute('selected')
        if (oldEl.selected !== selected) oldEl.selected = selected
    }
}


// Updates one surviving node in place. Callers establish the soft match first.
function morphNode(oldNode, newNode, pass) {

    if (oldNode.nodeType === Node.ELEMENT_NODE) {

        // Opt-out, for a subtree the page maintains itself.
        if (oldNode.hasAttribute('hud-preserve')) return

        // A SCRIPT is evaluated by the observer when it is inserted, so one that
        // survives a pass never runs again. A changed script has to arrive as a
        // new node to run at all.
        if (oldNode.tagName === 'SCRIPT') {
            if (oldNode.textContent !== newNode.textContent) {
                oldNode.parentNode.replaceChild(newNode, oldNode)
            }
            return
        }

        syncAttributes(oldNode, newNode, pass)
        syncBindingUUID(oldNode, pass)
        syncLiveProperties(oldNode, newNode)
        morphChildren(oldNode, newNode, pass, oldNode.firstChild, null)
        return
    }

    // Text and comment nodes carry a value and no structure.
    if (oldNode.nodeValue !== newNode.nodeValue) {
        oldNode.nodeValue = newNode.nodeValue
        if (oldNode.nodeType === Node.COMMENT_NODE) pass.changedComments.push(oldNode)
    }
}


// Reconciles a run of existing children against newParent's children.
//   parent:     the element being updated
//   newParent:  the parsed incoming markup, whose children are the target state
//   firstOld:   first existing node to consider
//   stopBefore: node to stop at, exclusive; null for the end of the parent
function morphChildren(parent, newParent, pass, firstOld, stopBefore) {

    // Index the keyed children up front, so a row that moved is matched as the
    // same row rather than diffed against whatever now sits in its slot. Without
    // it, one row inserted at the top reads as "every row changed", which can put
    // one row's values under another row's heading on the way past.
    const keyed = new Map()
    for (let node = firstOld; node && node !== stopBefore; node = node.nextSibling) {
        const key = morphKey(node)
        if (key && !keyed.has(key)) keyed.set(key, node)
    }

    let oldNode = firstOld
    let newNode = newParent.firstChild

    while (newNode) {
        const nextNew = newNode.nextSibling
        if (oldNode === stopBefore) oldNode = null

        const newKey = morphKey(newNode)

        // 1. The incoming node names a node already on the page, wherever it sits.
        if (newKey && keyed.has(newKey)) {
            const matched = keyed.get(newKey)
            keyed.delete(newKey)

            if (matched === oldNode) {
                oldNode = oldNode.nextSibling
            } else {
                // Repositioning a node is reported by the observer as a removal
                // then an addition. Unflagged, the removal unregisters a binding
                // that is still on the page and the addition binds a second
                // listener over the first.
                matched.hudMoved = true
                parent.insertBefore(matched, oldNode || stopBefore)
            }

            morphNode(matched, newNode, pass)
            newNode = nextNew
            continue
        }

        // 2. Otherwise pair it with whatever sits in the same position, unless
        //    that node is spoken for by a key of its own.
        if (oldNode && !morphKey(oldNode) && isSoftMatch(oldNode, newNode)) {
            const nextOld = oldNode.nextSibling
            morphNode(oldNode, newNode, pass)
            oldNode = nextOld
            newNode = nextNew
            continue
        }

        // 3. Nothing on the page corresponds to it, so it is new.
        parent.insertBefore(newNode, oldNode || stopBefore)
        newNode = nextNew
    }

    // Anything still ahead of the cursor was not in the incoming payload.
    while (oldNode && oldNode !== stopBefore) {
        const nextOld = oldNode.nextSibling
        parent.removeChild(oldNode)
        oldNode = nextOld
    }

    // Keyed nodes the payload never claimed, sitting behind the cursor.
    keyed.forEach(node => {
        if (node.parentNode === parent) parent.removeChild(node)
    })
}


// Applies HTML as the contents of target, writing only what differs.
function morphInner(target, html) {
    if (target == null) return

    if (!morphEnabled()) {
        target.innerHTML = html
        return
    }

    const incoming = parseInContext(html, target)
    const pass = newMorphPass()
    morphChildren(target, incoming, pass, target.firstChild, null)
    finishMorphPass(pass)
}


// Applies HTML in place of target itself. Falls back to replacing unless the
// payload is a single node that can update the target where it stands.
function morphOuter(target, html) {
    if (target == null) return

    const parent = target.parentNode
    if (!morphEnabled() || !parent) {
        target.outerHTML = html
        return
    }

    const incoming = parseInContext(html, parent)
    const only = incoming.childNodes.length === 1 ? incoming.firstChild : null

    if (only && isSoftMatch(target, only)) {
        const pass = newMorphPass()
        morphNode(target, only, pass)
        finishMorphPass(pass)
    } else {
        target.outerHTML = html
    }
}


// Applies HTML to the run of nodes between a reactive block's chunk comments.
function morphChunk(startComment, endComment, html) {
    const parent = startComment.parentNode
    const incoming = parseInContext(html, parent)
    const pass = newMorphPass()
    morphChildren(parent, incoming, pass, startComment.nextSibling, endComment)
    finishMorphPass(pass)
}


// Locates the comment pair delimiting a reactive block.
function findChunkComments(uuid) {
    const comments = document.createNodeIterator(document.body, NodeFilter.SHOW_COMMENT)

    let start = null
    let comment

    while (comment = comments.nextNode()) {
        const value = comment.nodeValue.trim()

        if (value === 'START_CHUNK@' + uuid) {
            start = comment
        } else if (value === 'END_CHUNK@' + uuid) {
            if (start && start.parentNode === comment.parentNode) {
                return { start: start, end: comment }
            }
            return null
        }
    }

    return null
}


// Takes over the socket's applyReaction handler so a reactive update morphs its
// chunk range instead of replacing it. Launchpad emits that handler with the
// page rather than defining it here, so it is wrapped, not edited.
function installReactionMorph(attempt) {
    const tries = attempt || 0

    // The socket script is only emitted for a launch that has bindings, and on a
    // relaunch may be attached after this file has initialised.
    if (typeof socket === 'undefined' || socket == null) {
        if (tries < 20) setTimeout(function() { installReactionMorph(tries + 1) }, 50)
        return
    }

    if (socket.hudMorphInstalled) return

    const original = socket.onmessage

    socket.onmessage = function(event) {
        let data = null
        try { data = JSON.parse(event.data) } catch (e) { }

        if (data && data.action === 'applyReaction' && morphEnabled()) {
            const chunk = findChunkComments(data.uuid)
            if (chunk) {
                console.log('Morphing Reaction: ' + event.data.length + ' bytes')
                morphChunk(chunk.start, chunk.end, data.payload)
                return
            }
        }

        if (typeof original === 'function') original.call(this, event)
    }

    socket.hudMorphInstalled = true
    console.log('HUD-CORE: reactive updates are morphed, not swapped.')
}



// Parses an event to determine the payloadTarget element
function getTargetElement(event) {
    let target = event.currentTarget.getAttribute('target')
    let element = event.currentTarget

    setTimeout(() => { }, 1)

    if (target === null && element != null) {
        let parent = element.parentElement
        while (parent != null) {
            if (parent.hasAttribute('target')) {
                target = parent.getAttribute('target')
                break
            }
            parent = parent.parentElement
        }
        if (parent != null)
            element = parent
    }

    if (target == null) return null

    const wrapper = element.hasAttribute('wrapper') ? element.getAttribute('wrapper') : 'div'
    return resolveTarget(target, element, wrapper)
}


// Binds functionality for on-* attribute
function setupOnAttribute(eventName, element) {
    // Determine the ENDPOINT
    const endpoint = element.getAttribute('on-' + eventName)
    if (endpoint == null) { return }

    element.setAttribute('lp-uuid', endpoint.replace('/!/lp/bind?uuid=', ''))

    // Idempotent per event name. A node that survives a morph can be handed here
    // again, and a second listener would fire the action twice.
    if (!element.hudBoundEvents) { element.hudBoundEvents = {} }
    if (element.hudBoundEvents[eventName]) { return }
    element.hudBoundEvents[eventName] = true

    // Add event listener to the element. The endpoint is re-read on dispatch
    // rather than captured here: an element that survives a morph keeps this one
    // listener while the server hands it a fresh uuid on every render.
    element.addEventListener(eventName, event => {
        const current = element.getAttribute('on-' + eventName)

        // The server can also drop an on-* attribute from a node that stays on
        // the page. With it gone there is no action left to fire.
        if (current == null) { return }

        fetchDataAndUpdate(event, current)
        // If the event is 'SUBMIT' and the element is a form, then also prevent the default form submission
        if (eventName === 'submit' && element.tagName === 'FORM') {
            event.preventDefault()
        }
        // if the event is 'CHANGE' and the element is an input, then also listen for the ENTER key to BLUR the input
        if (eventName === 'change' && element.tagName === 'INPUT' && !element.hudBoundEvents.enterToBlur) {
            // console.log('ON-CHANGE + INPUT: Adding BLUR input on enter.')
            element.hudBoundEvents.enterToBlur = true
            element.addEventListener('keydown', event => {
                if (event.key === 'Enter') { event.currentTarget.blur() }
            })
        }
    })
}


// Called when an on-* event is triggered to see through the server call and provide an
// update to the DOM with the response.
async function fetchDataAndUpdate(event, url) {

    console.log('Triggered Event', event)

    // If the target element has resulted in a fatal-error from a previous
    // rendering, then don't fetch data again.

    if (event.target.hasAttribute('fatal-error')) {
        console.log('Component has fatal error, not fetching data.')
        console.log(`EVENT -> ${event.type}`
            + `\nELEMENT -> ${event.target.tagName}`
            + `\nURL -> ${url}`)
        return
    }

    // Stop the event from bubbling up the DOM, sorry, too many edge cases.
    event.stopPropagation()

    // Identify the payloadTarget element. It may be different from the event.target
    const payloadTarget = getTargetElement(event)

    // Send the data from the event.target to the server via the URL endpoint,
    // and render the response into the payloadTarget.

    let activeTarget = event.currentTarget
    if (!activeTarget || event.currentTarget?.getAttribute('source') === 'auto') {
        activeTarget = event.target
    }

    if (event.currentTarget?.getAttribute('source') === 'strict') {
        if (event.target !== event.currentTarget) {
            console.log('Not firing. Strict.')
            return
        }
    }

    // Allow the activeTarget to be a querySelector of a parent element
    if (event.currentTarget?.getAttribute('source')
        && event.target.getAttribute('source') !== 'auto'
        && event.currentTarget.getAttribute('source') !== 'auto') {
        let checkElement = event.target

        while (checkElement) {
            if (checkElement.matches(event.currentTarget.getAttribute('source'))) {
                activeTarget = checkElement
                break
            }
            checkElement = checkElement.parentElement

            // Stop if the checkElement is the event.currentTarget
            if (checkElement === event.currentTarget) {
                // Set the activeTarget to the event.currentTarget if it matches the 'source' attribute
                if (event.currentTarget.matches(event.currentTarget.getAttribute('source'))) {
                    activeTarget = event.currentTarget
                    break
                } else {
                    // Otherwise, stop the loop
                    checkElement = null
                }
            }
        }

        if (checkElement === null) console.log('No source match. Checking IDs.')

        // Or, just a straight up ID, page scope
        if ( checkElement === null && event.currentTarget.getAttribute('source').startsWith('#')) {
            activeTarget = document.querySelector(event.currentTarget.getAttribute('source'))
        }

        if (checkElement === null && activeTarget == null) {
            console.log('No source match.')
            return
        } else {
            console.log('SOURCE MATCH (' + event.currentTarget.getAttribute('source') + ') -> ' + activeTarget.tagName)
        }
    }

    console.log(`EVENT -> ${event.type}`
        + `\nTARGET ELEMENT -> ${event.target?.tagName}`
        + `\nCURRENT-TARGET ELEMENT -> ${event.currentTarget?.tagName}`
        + `\nACTIVE-TARGET ELEMENT -> ${activeTarget?.tagName}`
        + '\nPAYLOAD-TARGET ELEMENT -> ' + payloadTarget?.tagName
        + `\nURL -> ${url}`)

    // Create an object to hold the POST data, and add the 'value' of the event.target
    let postData = {};


    //
    // EVENT DATA

    let elementType = activeTarget.getAttribute('type');
    let tagName = activeTarget.tagName.toLowerCase();

    //
    // VALUE

    if (elementType === 'checkbox' || elementType === 'radio') {
        if (activeTarget.checked)
            postData['value'] = activeTarget.value

    } else if (tagName === 'select' && activeTarget.multiple) {
        postData['value'] = Array.from(activeTarget.options)
            .filter(option => option.selected)
            .map(option => option.value)

    } else if (elementType === 'file') {
        // Account for single and multiple files
        // Send the file name and the contents in base64
        // Single file:
        if (activeTarget.files.length === 1) {
            postData['value'] = {name: activeTarget.files[0].name, data: await fileToBase64(activeTarget.files[0])}
        } else {
            // Multiple files:
            postData['value'] = []
            for (let file of activeTarget.files) {
                postData['value'].push({name: file.name, data: await fileToBase64(file)})
            }
        }

    } else if (activeTarget.value != null) {
        postData['value'] = activeTarget.value

    } else if (activeTarget.innerHTML != null && activeTarget.tagName !== 'FORM') {
        postData['value'] = activeTarget.innerHTML.split('\n')
            .map(line => line.trim()).join(' ')
            .replace(/\s+/g, ' ')
    }


    // Mouse events
    if (event.clientX != null) {
        postData['clientX'] = event.clientX;
    }
    if (event.clientY != null) {
        postData['clientY'] = event.clientY;
    }
    if (event.screenX != null) {
        postData['screenX'] = event.screenX;
    }
    if (event.screenY != null) {
        postData['screenY'] = event.screenY;
    }
    if (event.pageX != null) {
        postData['pageX'] = event.pageX;
    }
    if (event.pageY != null) {
        postData['pageY'] = event.pageY;
    }
    if (event.movementX != null) {
        postData['movementX'] = event.movementX;
    }
    if (event.movementY != null) {
        postData['movementY'] = event.movementY;
    }
    if (event.buttons != null) {
        postData['buttons'] = event.buttons;
    }
    if (event.button != null) {
        postData['button'] = event.button;
    }
    if (event.offsetX != null) {
        postData['offsetX'] = event.offsetX;
    }
    if (event.offsetY != null) {
        postData['offsetY'] = event.offsetY;
    }


    // Keyboard events
    if (event.key != null) {
        postData['key'] = event.key;
    }
    if (event.keyCode != null) {
        postData['keyCode'] = event.keyCode;
    }
    if (event.shiftKey != null) {
        if (event.shiftKey)
            postData['shiftKey'] = event.shiftKey;
    }
    if (event.ctrlKey != null) {
        if (event.ctrlKey)
            postData['ctrlKey'] = event.ctrlKey;
    }
    if (event.altKey != null) {
        if (event.altKey)
            postData['altKey'] = event.altKey;
    }
    if (event.metaKey != null) {
        if (event.metaKey)
            postData['metaKey'] = event.metaKey
    }
    if (event.repeat != null) {
        if (event.repeat)
            postData['repeat'] = event.repeat
    }


    //
    // ELEMENT DATA

    if (activeTarget.contentEditable) {
        if (activeTarget.isContentEditable) {
            postData['contentEditable'] = 'true'
        }
    }

    // Include client-side binding attribute
    if (activeTarget.hasAttribute('bind')) {
        postData['bind'] = activeTarget.getAttribute('bind')
    }

    // Include the ID of the element, if it exists
    if (activeTarget.id) {
        postData['elementId'] = activeTarget.id
    }

    postData['classList'] = Array.from(activeTarget.classList)

    postData['tagName'] = activeTarget.tagName

    // Also always send along the innerText of the element
    postData['innerText'] = activeTarget.innerText?.trim();

    // console.log('Text Content: ' + activeTarget.textContent)
    postData['textContent'] = activeTarget.textContent?.trim();



    //
    // COLLECTED DATA

    // Check the URL for a query string, and add it to the POST data, then modify the url to remove the querystring
    if (window.location.search) {
        const queryString = window.location.search.substring(1);

        queryString.split('&').forEach(pair => {
            const [key, value] = pair.split('=').map(decodeURIComponent);
            postData[key] = value;
        });
    }

    // FORM DATA

    let form = activeTarget;

    // Traverse up through the parents to find a form
    while (form && form.tagName !== 'FORM') {
        form = form.parentElement;
    }

    if (form && form.tagName === 'FORM') {
        const formData = new FormData(form);

        for (let [key, value] of formData.entries()) {
            const element = form.elements[key];
            console.log(element)
            if (!element) continue; // Skip if element does not exist (or display: none)

            const elementType = element.type;

            // Check if the element type is any type of date input
            if (['date', 'datetime-local', 'month', 'week', 'time'].includes(elementType)) {
                const dateValue = new Date(value);
                postData[key] = dateValue.getTime(); // milliseconds since epoch, spaceport standard for time
            } else if (elementType === 'checkbox' || elementType === 'radio') {
                postData[key] = element.checked;
            } else if (elementType === 'file') {
                // Only do this if the event type is a submit
                if (event.type === 'submit') {
                    // include a list of objects that include the name and contents of the file in base64
                    postData[key] = [];
                    // set a class of 'loading' on the file input
                    element.setAttribute('loading', 'true');
                    for (let file of element.files) {
                        postData[key].push({name: file.name, value: await fileToBase64(file)});
                    }
                    // remove the class of 'loading' on the file input
                    element.removeAttribute('loading');
                } else {
                    // Otherwise, just include the file names
                    postData[key] = []
                    for (let file of element.files) {
                        postData[key].push({name: file.name, value: null});
                    }
                }
            } else if (elementType === 'select-multiple') {
                postData[key] = Array.from(element.options)
                    .filter(option => option.selected)
                    .map(option => option.value);
            } else {
                postData[key] = value;
            }
        }

        // Custom 'form' elements (must return a value)
        for (let element of form.querySelectorAll('[name]')) {
            // If the key already exists in postData, then skip
            if (postData[element.getAttribute('name')]) continue
            // Check the .value of the element, and if it exists, add it to postData
            if (element.value) {
                postData[element.getAttribute('name')] = element.value
            }
        }

    }

    //
    // DATA ATTRIBUTES

    // currentTarget is the element that the event listener is attached to
    if (event.currentTarget)
        // DATA-* attributes and their values are also added for the server to consider
        for (let i = 0; i < event.currentTarget.attributes.length; i++) {
            const attr = event.currentTarget.attributes[i];
            if (attr.name.startsWith('data-')) {
                postData[attr.name.replace('data-', '')] = attr.value;
            }
        }

    // target is the element that triggered the event, and could be a child
    // element of the currentTarget. Allow overriding of data attributes
    // from the target element, unless the currentTarget 'source' attribute is 'strict'.
    if (activeTarget?.attributes && event.currentTarget?.getAttribute('source') !== 'strict')
        for (let i = 0; i < activeTarget.attributes.length; i++) {
            const attr = activeTarget.attributes[i];
            if (attr.name.startsWith('data-')) {
                postData[attr.name.replace('data-', '')] = attr.value;
            }
        }

    //
    // INCLUDED DATA

    // Allow the inclusion of localStorage and sessionStorage data
    if (activeTarget.hasAttribute('include')) {
        // If the element has an 'include' attribute, split it up and use the parts as
        // keys from localStorage and sessionStorage to include in the POST data.
        // allow , or ; or ' ' as separators
        const keys = activeTarget.getAttribute('include').split(/[,; ]+/)
        keys.forEach(key => {
            if (key === 'all-attributes') {
                // Include all attributes from the target element
                for (let i = 0; i < activeTarget.attributes.length; i++) {
                    const attr = activeTarget.attributes[i]
                    if (attr.name === 'on-' + event.type.toLowerCase()) continue
                    postData[attr.name] = attr.value
                }
            } else if (key.startsWith('~~')) {
                // If the key starts with '~~', then it is localstorage
                postData[key.substring(2)] = sessionStorage.getItem(key.substring(2))
            } else if (key.startsWith('~')) {
                // If the key starts with '~', then it is sessionstorage
                postData[key.substring(1)] = localStorage.getItem(key.substring(1))
            } else {
                // Otherwise, guess -- but probably an attribute
                postData[key] = activeTarget.getAttribute(key) || localStorage.getItem(key) || sessionStorage.getItem(key)
            }
        })
    }

    // Change queryString parameters to POST data.

    if (url.includes('?')) {
        const queryString = url.substring(url.indexOf('?') + 1)
        queryString.split('&').forEach(pair => {
            const key = pair.split('=')[0]
            const value = pair.split('=')[1]
            postData[key] = value
        })
        url = url.substring(0, url.indexOf('?'))
    }

    // Set up fetch options
    const fetchOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData)
    };


    if (payloadTarget)
        payloadTarget.setAttribute('loading', 'true')
    else
        activeTarget.setAttribute('loading', 'true')

    // Update the payload, but watch for a <fatal-error> from the response.
    // Usually, the error will render, but more importantly it will keep from
    // fetching data again causing possible corruption.
    const response = await fetch(url, fetchOptions)
    const responseData = response.clone()

    if (payloadTarget)
        payloadTarget.removeAttribute('loading')
    else
        activeTarget.removeAttribute('loading')


    const text = await response.text()
    let payload
    try {
        payload = await responseData.json()
    } catch (e) { }

    if (!payloadTarget && !payload) {
        console.log('Fetch complete, but no target or payload.')
        // console.log(payload)
        return
    }

    if (text === undefined || text.startsWith('null')) {
        console.log('No valid response text.')
        return
    }

    // console.log('Response Text: "' + text + '"')

    if (!payloadTarget) {
        console.log('WARNING: No payload target.')
    }

    // Spaceport FATAL-ERROR
    if (text.startsWith('<fatal')) { payloadTarget.setAttribute('fatal-error', 'true') }

    // Apply transmission payload
    const context = {
        event,
        activeTarget,
        sourceTarget: activeTarget,
        outerMode: activeTarget.getAttribute('target') === 'outer'
    }
    const instruction = (payload && (payload instanceof Object || payload instanceof Array)) ? payload : text
    applyInstructions(payloadTarget, instruction, context)
}


// File upload utility
async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}


// Binds click functionality for global HREF attribute
function setupHREF(element) {
    if (element.tagName !== 'A') {
        // Idempotent, like setupOnAttribute: a node that survives a morph can be
        // offered to this function more than once.
        if (element.hudHrefBound) { return }
        element.hudHrefBound = true

        element.addEventListener('click', event => {
            let ell = event.target
            out:
                while (ell != null) {
                    if (ell.hasAttribute('href')) {
                        window.location.href = ell.getAttribute('href')
                        ell = null
                        break out
                    } else ell = ell.parentElement
                }
        })

        if (!element.hasAttribute('tabindex'))
            element.setAttribute('tabindex', '0')

        element.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                window.location.href = event.target.getAttribute('href')
            }
        })
        // console.log(`ATTACHED -> HUD-*:HREF: ${element.tagName}`)
    }
}


//
//
// Document Data
//
//


// DocumentData is a way to pass data from the server to the client and update
// any elements that are bound to the data.

// Create a handler for the Proxy
const documentDataHandler = {
    set: function(target, property, value) {
        // console.log(`DOCUMENT_DATA SET: ${String(property)} = ${value}`)
        target[property] = value
        // Call refreshDocumentData after a property is set
        refreshDocumentData()
        return true  // Indicate success
    },
    deleteProperty: function(target, property) {
        // console.log(`DOCUMENT_DATA DELETE: ${String(property)}`)
        delete target[property]
        // Call refreshDocumentData after a property is deleted
        refreshDocumentData()
        return true  // Indicate success
    }
}


// Initialize documentData as a Proxy
var documentData = new Proxy({}, documentDataHandler)


/**
 * Sets a property on the documentData object using dot notation.
 * If intermediate objects in the path do not exist, they will be created
 * as reactive Proxies. Setting a value will trigger any bound elements to refresh.
 *
 * @param {string} path - The dot-notation path to the property (e.g., "user.profile.name").
 * @param {*} value - The value to set at the specified path.
 */
function setDocumentDataProperty(path, value) {
    if (typeof path !== 'string' || path.trim() === '') {
        console.error('setDocumentDataProperty: Path must be a non-empty string.');
        return
    }

    const keys = path.split('.')
    let current = documentData // Start with the root reactive object

    // Traverse or create the path up to the parent of the final property
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i]

        // Check if the current level is an object. If not, we can't proceed.
        if (typeof current !== 'object' || current === null) {
            console.error(`setDocumentDataProperty: Cannot create/traverse path. Segment '${keys.slice(0, i).join('.')}' is not an object:`, current)
            return
        }

        // If the next key doesn't exist on the current object, or if it's not an object itself,
        // we need to create a new reactive object (proxy) at this key.
        // The assignment `current[key] = {}` will trigger the `set` trap of `current` (if `current` is a proxy).
        // The `set` trap, through `makeReactive`, will ensure the new empty object `{}` becomes a proxy.
        if (!Object.prototype.hasOwnProperty.call(current, key) ||
            typeof current[key] !== 'object' ||
            current[key] === null) {
            // This assignment invokes the 'set' trap of the 'current' proxy.
            // The 'set' trap will then use 'makeReactive' to ensure that the new
            // empty object becomes a reactive proxy.
            current[key] = {}
        }

        current = current[key] // Move to the next object in the path.
    }

    // Set the value on the final key of the path.
    const lastKey = keys[keys.length - 1]

    if (typeof current !== 'object' || current === null) {
        console.error(`setDocumentDataProperty: Cannot set final property. Parent at path '${keys.slice(0, -1).join('.')}' is not an object:`, current)
        return
    }

    // This assignment also goes through the 'set' trap of the 'current' proxy (the parent object).
    // The 'set' trap will make 'value' reactive if it's an object/array
    // and will trigger refreshDocumentData().
    current[lastKey] = value
}


/**
 * Writes a new value to the documentData object at the path specified by the 'bind' attribute.
 *
 * @param newValue
 */
HTMLElement.prototype.hudWrite = function(newValue) {
    if (this.hasAttribute('bind')) {
        const path = this.getAttribute('bind')
        if (path) { // Ensure path is not empty
            setDocumentDataProperty(path, newValue)
        } else {
            console.warn('Element has "bind" attribute, but it is empty. hudWrite ignored.', this)
        }
    } else {
        // Optional: Log a warning if called on an element without a 'bind' attribute.
        // console.warn('hudWrite called on an element without a "bind" attribute.', this);
    }
}


/**
 * Reads the value reactively bound to this element using the 'bind' attribute.
 *
 * @returns {any} The value bound to this element, or undefined if the path doesn't exist.
 */
HTMLElement.prototype.hudRead = function() {
    if (this.hasAttribute('bind')) {
        const path = this.getAttribute('bind')
        if (path) { // Ensure path is not empty
            let value = documentData
            const keys = path.split('.')
            for (let key of keys) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key]
                } else {
                    return undefined // Path doesn't exist
                }
            }
            return value
        } else {
            console.warn('Element has "bind" attribute, but it is empty. hudRead ignored.', this)
        }
    } else {
        // Optional: Log a warning if called on an element without a 'bind' attribute.
        // console.warn('hudRead called on an element without a "bind" attribute.', this);
    }
}


// Scans for DocumentData comments
function scanForComments(node) {
    node.childNodes.forEach(child => {
        if (child.nodeType === Node.COMMENT_NODE) {
            parseForDocumentData(child);
        }
        // Recursively scan child nodes
        scanForComments(child);
    });
}


// Utility for DocumentData
function deepMerge(target, source, rootProxy) {
    for (let key in source) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
            if (!target[key] || typeof target[key] !== 'object') {
                // If the target property doesn't exist or isn't an object, create a new proxy for it
                // This ensures nested objects also trigger refreshDocumentData
                target[key] = new Proxy({}, documentDataHandler);
            }
            deepMerge(target[key], source[key], rootProxy); // Pass rootProxy for refresh call
        } else {
            // Directly set the value. The proxy's 'set' handler on the appropriate level
            // (either root or nested proxy) will take care of calling refreshDocumentData.
            target[key] = source[key];
        }
    }
}


function parseForDocumentData(node) {
    // console.log(node.nodeValue)
    if (!node.nodeValue.startsWith('<![CDATA[')) { return }
    let cData = JSON.parse(node.nodeValue.replace('<![CDATA[', '').replace(']]>', ''))

    // Temporarily disable refresh during bulk update by creating a temporary non-proxied object for merging
    let tempDocumentData = JSON.parse(JSON.stringify(documentData)); // Create a deep clone without proxies

    if (cData.append) {
        // For deepMerge, we want to merge into the actual target (tempDocumentData)
        // The proxy will handle individual assignments if we were to assign directly.
        // However, for a bulk update, it's more efficient to merge into a temp object
        // and then assign back to the proxied documentData, or update properties one by one
        // if we want fine-grained proxy trapping on each sub-property.

        // Simpler approach for cData.append: iterate and assign to the proxy
        // This will trigger the proxy's set handler for each top-level property in cData.
        // For deeper properties within cData, ensure deepMerge correctly creates nested proxies.
        const dataToMerge = { ...cData }; // Clone cData
        delete dataToMerge.append; // Remove the "append" flag before merging

        deepMerge(documentData, dataToMerge, documentData); // Merge into the proxy

    } else {
        // Assign properties directly to the proxy to trigger the 'set' handler
        for (let key in cData) {
            // console.log(`DOCUMENT DATA (cData) -> ${key} = ${cData[key]}`)
            // If cData[key] is an object, we need to ensure it becomes a proxy too,
            // or its nested properties won't trigger refreshDocumentData.
            if (typeof cData[key] === 'object' && cData[key] !== null && !Array.isArray(cData[key])) {
                // If the existing documentData[key] is not a proxy or doesn't exist, create one
                if (!(documentData[key] instanceof Object) || !('_isProxy' in documentData[key])) { // A simple check, could be more robust
                    documentData[key] = new Proxy({}, documentDataHandler);
                    // Add a flag to identify it as a proxy if needed, though instanceof Proxy isn't reliable
                    // Object.defineProperty(documentData[key], '_isProxy', { value: true, enumerable: false });
                }
                deepMerge(documentData[key], cData[key], documentData);
            } else {
                documentData[key] = cData[key]; // This will trigger the proxy's set handler
            }
        }
    }
    // The proxy's 'set' handlers should have called refreshDocumentData for each change.
    // refreshDocumentData();
}


function refreshDocumentData() {
    // console.log('Refreshing document data, current state:', JSON.parse(JSON.stringify(documentData)));
    document.querySelectorAll('[bind]').forEach(element => {
        const key = element.getAttribute('bind');
        let valueToSet;
        let keyExists = false;

        // Check for 'dot' notation for nested objects
        if (key.includes('.')) {
            let parts = key.split('.');
            let current = documentData;
            let pathExists = true;
            for (let i = 0; i < parts.length; i++) {
                if (current && typeof current === 'object' && parts[i] in current) {
                    current = current[parts[i]];
                } else {
                    pathExists = false;
                    break;
                }
            }
            if (pathExists) {
                valueToSet = current;
                keyExists = true;
            }
        } else if (key in documentData) { // Direct key
            valueToSet = documentData[key];
            keyExists = true;
        }

        if (keyExists) {
            if (element.setValue && typeof element.setValue === 'function') {
                // If the element has a custom .setValue() method, pass the raw value.
                // The custom element is responsible for handling the data type.
                if (element.getValue && typeof element.getValue === 'function') {
                    if (element.getValue() !== valueToSet) {
                        element.setValue(valueToSet);
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                } else {
                    element.setValue(valueToSet);
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else {
                // For standard .value or .innerHTML, first format the value for display.
                const displayValue = formatForDisplay(valueToSet);

                if (typeof element.value !== 'undefined' &&
                    // Be more specific about elements that use the 'value' property for primary content
                    (element.tagName === 'INPUT' ||
                        element.tagName === 'TEXTAREA' ||
                        element.tagName === 'SELECT' ||
                        element.tagName === 'OPTION' || // Though typically its text content or parent select's value is bound
                        element.tagName === 'PROGRESS' ||
                        element.tagName === 'METER'
                        /* Add other relevant tags if necessary */
                    )) {
                    // For elements with a 'value' property (typically form elements)
                    if (element.value !== displayValue) {
                        element.value = displayValue
                        element.dispatchEvent(new Event('change', { bubbles: true }))
                    }
                } else if(element.value !== undefined) { // Allow for 'custom' elements that might have a .value mechanism
                    element.value = displayValue
                    element.dispatchEvent(new Event('change', { bubbles: true })) // Dispatch change for consistency
                } else {
                    // For other elements, update innerHTML.
                    if (element.innerHTML !== displayValue) {
                        element.innerHTML = displayValue
                        element.dispatchEvent(new Event('change', { bubbles: true })) // Dispatch change for consistency
                    }
                }
            }
        } else {
            // console.log(`Key "${key}" not found in documentData for element ${element.tagName}`, element, documentData);
        }
    });
}


 // Formats a value for display in the UI (element.value or element.innerHTML).
 // Avoids showing "[Object object]" or function bodies.
function formatForDisplay(value) {
    if (value === null || typeof value === 'undefined') {
        return '' // Display null or undefined as an empty string
    }

    const type = typeof value

    if (type === 'string' || type === 'number' || type === 'boolean') {
        return String(value); // These are generally safe to display as is
    }

    if (type === 'function') {
        return ''  // Don't display function bodies; an empty string is often best for UI

    }

    if (Array.isArray(value)) {
        // For arrays, a simple comma-separated list if it contains primitives.
        return value.every(item => ['string', 'number', 'boolean'].includes(typeof item))
                          ? value.join(', ')
                          : '[Array]'
    }

    if (type === 'object') {
        // For generic objects, avoid "[object Object]".
        // An empty string or a placeholder is usually best.
        return ''
    }

    // if HTMLElement
    if (value instanceof HTMLElement) {
        // For DOM elements, return their outerHTML or a placeholder
        return value.outerHTML || '[Element]'
    }

    // Fallback for any other types (e.g., Symbol, BigInt)
    // This will use their default string conversion, which might still be like "[Symbol symbol]"
    // but these are less common in typical UI-bound data.
    return String(value)
}



//
//
// History Management
//
//

window.addEventListener('popstate', function(event) {
    // reload the page
    window.location.reload()
})


//
//
// Form Blur Event
//
//


var focusedForm = null;


window.addEventListener('focusin', (event) => {
    const form = event.target.closest('form');
    if (form) {
        focusedForm = form
    }
})


// Fire a formblur event when the form loses focus, allowing the user to traverse
// inputs and buttons within, but get an event when the form is otherwise blurred.
window.addEventListener('focusout', (event) => {
    setTimeout(() => {
        if (focusedForm && !focusedForm.contains(document.activeElement)) {
            // Create and dispatch the custom 'formblur' event
            const formBlurEvent = new CustomEvent('formblur', {
                bubbles: true,
                cancelable: true
            });
            focusedForm.dispatchEvent(formBlurEvent)
            focusedForm = null
        }
    }, 0)
})



