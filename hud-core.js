// HUD-CORE v1.1.0

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


document.addEventListener('DOMContentLoaded', function() {

    // Scan DOM for 'comment' nodes and parse for document data
    scanForComments(document)

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

                // Call the attributeChanged function if it exists on the target node
                if (targetNode.hasOwnProperty('attributechanged')) {
                    try {
                        targetNode.attributechanged(targetNode, mutation.attributeName, mutation.oldValue, targetNode.getAttribute(mutation.attributeName));
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


    // Elements that have a HREF attribute will be automatically registered for click events
    // and will navigate the page to the specified URL.
    document.querySelectorAll('[href]').forEach(element => {
        setupHREF(element)
    })

    // Configuration of the observer
    const config = { attributes: true, childList: true, subtree: true, attributeOldValue: true }

    // Observe the entire document for mutations, apply appropriate changes
    observer.observe(document.body, config)

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
    // 'on-drag',
    // 'on-dragend',
    'on-dragenter',
    'on-dragleave',
    // 'on-dragover',
    // 'on-dragstart',
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
    'on-formblur'
]


// Parses an event to determine the payloadTarget element
function getTargetElement(event) {
    let target = event.currentTarget.getAttribute('target')
    let element = event.currentTarget

    // Set 0 timeout to allow for the event to finish bubbling
    setTimeout(() => { }, 1)

    if (target === null && element != null) {
        let parent = element.parentElement
        // No target, so look for a parent with a target
        while (parent != null) {
            if (parent.hasAttribute('target')) {
                target = parent.getAttribute('target')
                break
            }
            parent = parent.parentElement
        }
        // Can't be guaranteed that there's a parent with a target
        if (parent != null)
            element = parent
    }


    // console.log(target)


    // Specify 'self' to render back to the element that triggered the event
    if (target === 'self' || target === 'outer') { // 'outer' is a special case that is handled later
        return element
    }

    // Sure, specify 'none'
    if (target === 'none') {
        return null
    }

    // Require a valid target to continue
    if (target == null) return null

    // Some targets involve adding a new element to the DOM, so this provides a way to define a wrapper. Default: <DIV>
    const tagType = element.hasAttribute('element-type') ? element.getAttribute('element-type') : 'div'

    // Now get the target element based on the target string
    switch (target) {
        case 'parent':
            return element.parentElement
        case 'grandparent':
            return element.parentElement.parentElement

        case 'next':
            return element.nextElementSibling
        case 'previous':
            return element.previousElementSibling

        case 'first':
            return element.firstElementChild
        case 'last':
            return element.lastElementChild

        case 'after':
            element.insertAdjacentHTML('afterend', `<${tagType}></${tagType}>`)
            return element.nextElementSibling
        case 'before':
            element.insertAdjacentHTML('beforebegin', `<${tagType}></${tagType}>`)
            return element.previousElementSibling
        case 'append':
            element.insertAdjacentHTML('beforeend', `<${tagType}></${tagType}>`)
            return element.lastElementChild
        case 'prepend':
            element.insertAdjacentHTML('afterbegin', `<${tagType}></${tagType}>`)
            return element.firstElementChild

        case 'nth-sibling':
            const index = parseInt(element.getAttribute('sibling-index'), 10)
            return element.parentNode?.children[index] || null
        case 'nth-child':
            const childIndex = parseInt(element.getAttribute('child-index'), 10)
            return element.children[childIndex] || null
        case 'nth-parent':
            const parentIndex = parseInt(element.getAttribute('parent-index'), 10)
            return element.parentElement?.parentElement?.children[parentIndex] || null

        case 'ancestor-tag':
            const tagName = element.getAttribute('ancestor-tag')
            let parent = element.parentElement
            while (parent) {
                if (parent.tagName.toLowerCase() === tagName.toLowerCase()) {
                    return parent
                }
                parent = parent.parentElement
            }
            return null
        case 'ancestor-class':
            const className = element.getAttribute('ancestor-class')
            let parent2 = element.parentElement
            while (parent2) {
                if (parent2.classList.contains(className)) {
                    return parent2
                }
                parent2 = parent2.parentElement
            }
            return null
        case 'descendant-tag':
            const descendantTagName = element.getAttribute('descendant-tag')
            return element.querySelector(descendantTagName)

        case 'descendant-class':
            const descendantClassName = element.getAttribute('descendant-class')
            return element.querySelector('.' + descendantClassName)

        default:
            if (target.startsWith('>')) {
                return element.querySelector(target.substring(1))
            }

            return document.querySelector(target) || null
    }
}


// Binds functionality for on-* attribute
function setupOnAttribute(eventName, element) {
    // Determine the ENDPOINT
    const endpoint = element.getAttribute('on-' + eventName)
    // Add event listener to the element
    element.addEventListener(eventName, event => {
        fetchDataAndUpdate(event, endpoint)
        // If the event is 'SUBMIT' and the element is a form, then also prevent the default form submission
        if (eventName === 'submit' && element.tagName === 'FORM') {
            event.preventDefault()
        }
        // if the event is 'CHANGE' and the element is an input, then also listen for the ENTER key to BLUR the input
        if (eventName === 'change' && element.tagName === 'INPUT') {
            // console.log('ON-CHANGE + INPUT: Adding BLUR input on enter.')
            element.addEventListener('keydown', event => {
                if (event.key === 'Enter') { event.currentTarget.blur() }
            })
        }
    })
    element.setAttribute('lp-uuid', endpoint.replace('/!/lp/bind?uuid=', ''))
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
        // Or, just a straight up ID
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
            } else if (key.startsWith('*')) {
                // If the key starts with '*', then it is localstorage
                postData[key.substring(1)] = localStorage.getItem(key.substring(1))
            } else if (key.startsWith('~')) {
                // If the key starts with '~', then it is sessionstorage
                postData[key.substring(1)] = sessionStorage.getItem(key.substring(1))
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

    // Is the payload text or json?
    if (payload && (payload instanceof Object || payload instanceof Array)) {

        // If the payload is an array, then it is a list of class names (or actions)
        if (Array.isArray(payload)) {
            payload.forEach(className => {
                if (!className.startsWith) {
                    // Not a String
                } else if (className.startsWith('@')) {
                    if (className === '@click') {
                        payloadTarget.click()
                    } else if (className === '@focus') {
                        payloadTarget.focus()
                    } else if (className === '@blur') {
                        payloadTarget.blur()
                    } else if (className === '@select') {
                        payloadTarget.select()
                    } else if (className === '@submit') {
                        payloadTarget.submit()
                    } else if (className === '@reset') {
                        payloadTarget.reset()
                    } else if (className === '@remove') {
                        payloadTarget.remove()
                    } else if (className === '@show') {
                        if (payloadTarget.show) {
                            payloadTarget.show()
                        } else {
                            payloadTarget.style.display = payloadTarget.getAttribute('x-display')
                            payloadTarget.removeAttribute('x-display')
                        }
                    } else if (className === '@hide') {
                        if (payloadTarget.hide) {
                            payloadTarget.hide()
                        } else {
                            payloadTarget.setAttribute('x-display', payloadTarget.style.display)
                            payloadTarget.style.display = 'none'
                        }
                    } else if (className === '@scroll-to') {
                        payloadTarget.scrollTo()
                    } else if (className === '@clear') {
                        if (payloadTarget.value) {
                            payloadTarget.value = ''
                        } else {
                            payloadTarget.innerHTML = ''
                        }
                    } else if (className === '@reload') {
                        window.location.reload()
                    } else if (className === '@back') {
                        window.history.back()
                    } else if (className === '@forward') {
                        window.history.forward()
                    } else if (className === '@print') {
                        window.print()
                    }
                }

                // If the class name starts with a '-', then remove the class
                else if (className.startsWith('-')) {
                    className = className.substring(1)
                    payloadTarget.classList.remove(className)
                } else if (className.startsWith('+')) {
                    className = className.substring(1)
                    payloadTarget.classList.add(className)
                } else {
                    // toggle
                    if (payloadTarget.classList.contains(className)) {
                        payloadTarget.classList.remove(className)
                    } else {
                        payloadTarget.classList.add(className)
                    }
                }
            })
        }

        // If the payload is an object, then it might be attributes, styles, or data
        else if (typeof payload === 'object') {
            for (let key in payload) {
                if (key === 'value') {
                    payloadTarget.value = payload[key]
                } else if (key.toLowerCase() === 'insertbefore') {
                    payloadTarget.insertAdjacentHTML('beforebegin', payload[key])
                } else if (key.toLowerCase() === 'insertafter') {
                    payloadTarget.insertAdjacentHTML('afterend', payload[key])
                } else if (key === 'append'){
                    payloadTarget.insertAdjacentHTML('beforeend', payload[key])
                } else if (key === 'prepend') {
                    payloadTarget.insertAdjacentHTML('afterbegin', payload[key])
                } else if (key === 'innerHTML') {
                    payloadTarget.innerHTML = payload[key]
                } else if (key === 'outerHTML') {
                    payloadTarget.outerHTML = payload[key]
                } else if (key === 'innerText') {
                    payloadTarget.innerText = payload[key]
                } else if (key.startsWith("?")) {
                    // Update queryString in the URL
                    const queryString = key.substring(1)
                    const url = new URL(window.location.href)
                    // set the query string using the key as the parameter name and the payload[key] as the value
                    url.searchParams.set(queryString, payload[key])
                    // update the location
                    window.history.pushState({}, '', url)
                } else if (key.startsWith('#')) {
                    payloadTarget.dataset[key.substring(1)] = payload[key]
                } else if(key.startsWith('&')) {
                    // If the key starts with '&', then it is a style
                    payloadTarget.style[key.substring(1)] = payload[key]
                } else if(key.startsWith('@')) {
                    // If the key starts with '@', it's an action
                    if (key === '@click') {
                        if (payload[key] === 'this') {
                            event.target.click()
                        } else if (payload[key] === 'it') {
                            event.currentTarget.click()
                        } else if (payload[key] === 'source') {
                            activeTarget.click()
                        } else {
                            payloadTarget.click()
                        }
                    } else if (key === '@focus') {
                        if (payload[key] === 'this') {
                            event.target.focus()
                        } else if (payload[key] === 'it') {
                            event.currentTarget.focus()
                        } else if (payload[key] === 'source') {
                            activeTarget.focus()
                        } else {
                            payloadTarget.focus()
                        }
                    } else if (key === '@blur') {
                        if (payload[key] === 'this') {
                            event.target.blur()
                        } else if (payload[key] === 'it') {
                            event.currentTarget.blur()
                        } else if (payload[key] === 'source') {
                            activeTarget.blur()
                        } else {
                            payloadTarget.blur()
                        }
                    } else if (key === '@select') {
                        if (payload[key] === 'this') {
                            if (event.target.select) {
                                event.target.select()
                            } else {
                                let selection = window.getSelection()
                                let range = document.createRange()
                                range.selectNodeContents(event.target)
                                selection.removeAllRanges()
                                selection.addRange(range)
                            }
                        } else if (payload[key] === 'it') {
                            if (event.currentTarget.select) {
                                event.currentTarget.select()
                            } else {
                                let selection = window.getSelection()
                                let range = document.createRange()
                                range.selectNodeContents(event.currentTarget)
                                selection.removeAllRanges()
                                selection.addRange(range)
                            }
                        } else if (payload[key] === 'source') {
                            if (activeTarget.select) {
                                activeTarget.select()
                            } else {
                                let selection = window.getSelection()
                                let range = document.createRange()
                                range.selectNodeContents(activeTarget)
                                selection.removeAllRanges()
                                selection.addRange(range)
                            }
                        } else {
                            if (payloadTarget.select) {
                                payloadTarget.select()
                            } else {
                                let selection = window.getSelection()
                                let range = document.createRange()
                                range.selectNodeContents(payloadTarget)
                                selection.removeAllRanges()
                                selection.addRange(range)
                            }
                        }
                    } else if (key === '@end') {
                        // Move cursor to the end of the input or contenteditable
                        if (payload[key] === 'this') {
                            if (event.target.tagName === 'INPUT') {
                                event.target.selectionStart = event.target.value.length
                            } else {
                                let range = document.createRange()
                                let sel = window.getSelection()
                                range.setStart(event.target, 1)
                                range.collapse(true)
                                sel.removeAllRanges()
                                sel.addRange(range)
                            }
                        } else if (payload[key] === 'it') {
                            if (event.currentTarget.tagName === 'INPUT') {
                                event.currentTarget.selectionStart = event.currentTarget.value.length
                            } else {
                                let range = document.createRange()
                                let sel = window.getSelection()
                                range.setStart(event.currentTarget, 1)
                                range.collapse(true)
                                sel.removeAllRanges()
                                sel.addRange(range)
                            }
                        } else if (payload[key] === 'source') {
                            if (activeTarget.tagName === 'INPUT') {
                                activeTarget.selectionStart = activeTarget.value.length
                            } else {
                                let range = document.createRange()
                                let sel = window.getSelection()
                                range.setStart(activeTarget, 1)
                                range.collapse(true)
                                sel.removeAllRanges()
                                sel.addRange(range)
                            }
                        } else {
                            if (payloadTarget.tagName === 'INPUT') {
                                payloadTarget.selectionStart = payloadTarget.value.length
                            } else {
                                let range = document.createRange()
                                let sel = window.getSelection()
                                range.setStart(payloadTarget, 1)
                                range.collapse(true)
                                sel.removeAllRanges()
                                sel.addRange(range)
                            }
                        }
                    } else if (key === '@submit') {
                        if (payload[key] === 'this') {
                            event.target.submit()
                        } else if (payload[key] === 'it') {
                            event.currentTarget.submit()
                        } else if (payload[key] === 'source') {
                            activeTarget.submit()
                        } else {
                            payloadTarget.submit()
                        }
                    } else if (key === '@reset') {
                        if (payload[key] === 'this') {
                            event.target.reset()
                        } else if (payload[key] === 'it') {
                            event.currentTarget.reset()
                        } else if (payload[key] === 'source') {
                            activeTarget.reset()
                        } else {
                            payloadTarget.reset()
                        }
                    } else if (key === '@show') {
                        if (payload[key] === 'this') {
                            // if has a show() method, then call it
                            if (event.target.show) {
                                event.target.show()
                            }

                            else {
                                event.target.style.display = event.target.getAttribute('x-display')
                                event.target.removeAttribute('x-display')
                            }
                        } else if (payload[key] === 'it') {
                            if (event.currentTarget.show) {
                                event.currentTarget.show()
                            } else {
                                event.currentTarget.style.display = event.currentTarget.getAttribute('x-display')
                                event.currentTarget.removeAttribute('x-display')
                            }
                        } else if (payload[key] === 'source') {
                            if (activeTarget.show) {
                                activeTarget.show()
                            } else {
                                activeTarget.style.display = activeTarget.getAttribute('x-display')
                                activeTarget.removeAttribute('x-display')
                            }
                        } else {
                            if (payloadTarget.show) {
                                payloadTarget.show()
                            } else {
                                payloadTarget.style.display = payloadTarget.getAttribute('x-display')
                                payloadTarget.removeAttribute('x-display')
                            }
                        }

                    } else if (key === '@hide') {

                        if (payload[key] === 'this') {
                            // if has a hide() method, then call it
                            if (event.target.hide) {
                                event.target.hide()
                            }
                            // otherwise update style to 'visibility: hidden'
                            else {
                                event.target.setAttribute('x-display', event.target.style.display)
                                event.target.style.display = 'none'
                            }
                        } else if (payload[key] === 'it') {
                            if (event.currentTarget.hide) {
                                event.currentTarget.hide()
                            } else {
                                event.currentTarget.setAttribute('x-display', event.currentTarget.style.display)
                                event.currentTarget.style.display = 'none'
                            }
                        } else if (payload[key] === 'source') {
                            if (activeTarget.hide) {
                                activeTarget.hide()
                            } else {
                                activeTarget.setAttribute('x-display', activeTarget.style.display)
                                activeTarget.style.display = 'none'
                            }
                        } else {
                            if (payloadTarget.hide) {
                                payloadTarget.hide()
                            } else {
                                payloadTarget.setAttribute('x-display', payloadTarget.style.display)
                                payloadTarget.style.display = 'none'
                            }
                        }

                    } else if (key === '@open') {
                        if (payload[key] === 'this') {
                            if (event.target.tagName === 'DETAILS') {
                                event.target.setAttribute('open', 'true')
                            } else if (event.target.tagName === 'DIALOG') {
                                event.target.show()
                            } else {
                                event.target.open()
                            }
                        } else if (payload[key] === 'it') {
                            if (event.currentTarget.tagName === 'DETAILS') {
                                event.currentTarget.setAttribute('open', 'true')
                            } else if (event.currentTarget.tagName === 'DIALOG') {
                                event.currentTarget.show()
                            } else {
                                event.currentTarget.open()
                            }
                        } else if (payload[key] === 'source') {
                            if (activeTarget.tagName === 'DETAILS') {
                                activeTarget.setAttribute('open', 'true')
                            } else if (activeTarget.tagName === 'DIALOG') {
                                activeTarget.show()
                            } else {
                                activeTarget.open()
                            }
                        } else {
                            // if the payload[key] is a URL, window.open
                            if (payload[key].startsWith('http')) {
                                window.open(payload[key])
                            } else {
                                // otherwise, just open the dialog
                                if (payloadTarget.tagName === 'DETAILS') {
                                    payloadTarget.setAttribute('open', 'true')
                                } else if (payloadTarget.tagName === 'DIALOG') {
                                    payloadTarget.show()
                                } else {
                                    payloadTarget.open()
                                }
                            }
                        }

                    } else if (key === '@close') {
                        if (payload[key] === 'this') {
                            if (event.target.tagName === 'DETAILS') {
                                event.target.removeAttribute('open')
                            } else if (event.target.tagName === 'DIALOG') {
                                event.target.close()
                            } else {
                                event.target.closest('dialog')?.close()
                            }
                        } else if (payload[key] === 'it') {
                            if (event.currentTarget.tagName === 'DETAILS') {
                                event.currentTarget.removeAttribute('open')
                            } else if (event.currentTarget.tagName === 'DIALOG') {
                                event.currentTarget.close()
                            } else {
                                event.currentTarget.closest('dialog')?.close()
                            }
                        } else if (payload[key] === 'source') {
                            if (activeTarget.tagName === 'DETAILS') {
                                activeTarget.removeAttribute('open')
                            } else if (activeTarget.tagName === 'DIALOG') {
                                activeTarget.close()
                            } else {
                                activeTarget.closest('dialog')?.close()
                            }
                        } else if (payload[key] === 'window') {
                            window.close()
                        } else {
                            if (payloadTarget.tagName === 'DETAILS') {
                                payloadTarget.removeAttribute('open')
                            }
                            payloadTarget.close()
                        }
                    } else if (key === '@scroll-to') {
                        payloadTarget.scrollTo(payload[key])
                    } else if (key === '@scroll-by') {
                        payloadTarget.scrollBy(payload[key])
                    } else if (key === '@scroll-into-view') {
                        payloadTarget.scrollIntoView(payload[key])
                    } else if (key === '@remove') {
                        if (payload[key] === 'this') {
                            event.target.remove()
                        } else if (payload[key] === 'it') {
                            event.currentTarget.remove()
                        } else if (payload[key] === 'source') {
                            activeTarget.remove()
                        } else {
                            payloadTarget.remove()
                        }
                    } else if (key === '@clear') {
                        // If the value is 'this', then use the event.target
                        if (payload[key] === 'this') {
                            if (event.target.value) {
                                event.target.value = ''
                            } else {
                                event.target.innerHTML = ''
                            }
                        } else if (payload[key] === 'it') {
                            if (event.currentTarget.value) {
                                event.currentTarget.value = ''
                            } else {
                                event.currentTarget.innerHTML = ''
                            }
                        } else if (payload[key] === 'source') {
                            if (activeTarget.value) {
                                activeTarget.value = ''
                            } else {
                                activeTarget.innerHTML = ''
                            }
                        } else {
                            // Set either the value or innerHTML to an empty string
                            if (payloadTarget.value) {
                                payloadTarget.value = ''
                            } else {
                                payloadTarget.innerHTML = ''
                            }
                        }
                    } else if (key === '@reload') {
                        window.location.reload()
                    } else if (key === '@redirect') {
                        window.location.href = payload[key]
                    } else if (key === '@back') {
                        window.history.back()
                    } else if (key === '@forward') {
                        window.history.forward()
                    } else if (key === '@replace') {
                        window.history.replaceState(null, null, payload[key])
                    } else if (key === '@download') {
                        const a = document.createElement('a')
                        a.href = payload[key]
                        a.download = ''
                        a.click()
                    } else if (key === '@print') {
                        window.print()
                    } else if (key === '@alert') {
                        alert(payload[key])
                    } else if (key === '@log') {
                        console.log(payload[key])
                    } else if (key === '@table') {
                        console.table(payload[key])
                    }
                } else if (key.startsWith('*')) {
                    // If the key starts with '*', then it is localstorage
                    localStorage.setItem(key.substring(1), payload[key])
                } else if (key.startsWith('~')) {
                    // If the key starts with '~', then it is sessionstorage
                    sessionStorage.setItem(key.substring(1), payload[key])
                } else if (key.startsWith('+')) {
                    // If the key starts with '+', then it is a class
                    if (payload[key] === 'this') {
                        event.target.classList.add(key.substring(1))
                    } else if (payload[key] === 'it') {
                        event.currentTarget.classList.add(key.substring(1))
                        event.currentTarget.classList.add(key.substring(1))
                    } else if (payload[key] === 'source') {
                        activeTarget.classList.add(key.substring(1))
                    } else {
                        payloadTarget.classList.add(key.substring(1))
                    }
                } else if (key.startsWith('-')) {
                    // If the key starts with '-', then it is a class
                    if (payload[key] === 'this') {
                        event.target.classList.remove(key.substring(1))
                    } else if (payload[key] === 'it') {
                        event.currentTarget.classList.remove(key.substring(1))
                    } else if (payload[key] === 'source') {
                        activeTarget.classList.remove(key.substring(1))
                    } else {
                        payloadTarget.classList.remove(key.substring(1))
                    }
                } else {
                    if (payloadTarget) {
                        // Otherwise, it is an attribute
                        if (payload[key] == null) {
                            payloadTarget.removeAttribute(key)
                        } else payloadTarget.setAttribute(key, payload[key])
                    }
                }
            }

        }

    } else {

        if (payloadTarget == null) return

        if (payloadTarget.getAttribute('target') === 'outer') {
            // Replace the entire payloadTarget with new html
            payloadTarget.outerHTML = text
        } else {
            console.log('+> Standard PAYLOAD-TYPE')
            // Default is to update the value or innerHTML
            if (payloadTarget.value) {
                payloadTarget.value = text
            } else if (payloadTarget.setValue) {
                payloadTarget.setValue(text)
            } else {
                payloadTarget.innerHTML = text
            }
        }
    }
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
