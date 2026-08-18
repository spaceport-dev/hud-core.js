// Morph tests for hud-core. Run in headless chromium against the real DOM.

var fetchCalls = []
window.fetch = function(url, opts) {
    fetchCalls.push({ url: url, body: opts && opts.body ? JSON.parse(opts.body) : null })
    return Promise.resolve({ ok: true, text: function() { return Promise.resolve('') } })
}

var results = []

function ok(v, msg) { if (!v) throw new Error(msg) }
function eq(a, b, msg) { if (a !== b) throw new Error(msg + ' — expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)) }

function mk(html) {
    var host = document.createElement('div')
    host.innerHTML = html || ''
    document.body.appendChild(host)
    return host
}

function test(name, fn) {
    try { fn(); results.push({ name: name, pass: true }) }
    catch (e) { results.push({ name: name, pass: false, error: e.message }) }
}

// Counts the mutations a morph actually produces.
function countMutations(host, fn) {
    var obs = new MutationObserver(function() { })
    obs.observe(host, { attributes: true, childList: true, subtree: true, characterData: true })
    fn()
    var recs = obs.takeRecords()
    obs.disconnect()
    return recs
}


test('identical payload produces zero mutations', function() {
    var html = '<p>one</p><p>two</p><section><span>a</span><span>b</span></section>'
    var host = mk(html)
    var recs = countMutations(host, function() { morphInner(host, html) })
    eq(recs.length, 0, 'mutation count')
})

test('only the changed grandchild is written to', function() {
    var host = mk('<p>one</p><p>two</p><section><span>a</span><span>b</span><span>c</span></section>')
    var p0 = host.children[0], p1 = host.children[1], sec = host.children[2]
    var s0 = sec.children[0], s1 = sec.children[1], s2 = sec.children[2]
    var s1text = s1.firstChild

    var recs = countMutations(host, function() {
        morphInner(host, '<p>one</p><p>two</p><section><span>a</span><span>CHANGED</span><span>c</span></section>')
    })

    ok(host.children[0] === p0, 'first <p> is the same node')
    ok(host.children[1] === p1, 'second <p> is the same node')
    ok(host.children[2] === sec, '<section> is the same node')
    ok(sec.children[0] === s0, 'unchanged span a is the same node')
    ok(sec.children[1] === s1, 'changed span is still the same node')
    ok(sec.children[2] === s2, 'unchanged span c is the same node')
    ok(s1.firstChild === s1text, 'the text node itself was reused')
    eq(s1.textContent, 'CHANGED', 'changed text')
    eq(s0.textContent, 'a', 'sibling text untouched')
    eq(recs.length, 1, 'exactly one mutation')
    eq(recs[0].type, 'characterData', 'mutation is a text edit')
})

test('attributes are added, updated and removed', function() {
    var host = mk('<div id="at" class="one" data-keep="x" title="t"></div>')
    var el = host.querySelector('#at')
    el.setAttribute('loading', 'true')

    morphInner(host, '<div id="at" class="two" data-new="y"></div>')

    ok(host.querySelector('#at') === el, 'element identity')
    eq(el.className, 'two', 'class updated')
    eq(el.getAttribute('data-new'), 'y', 'attribute added')
    ok(!el.hasAttribute('data-keep'), 'stale attribute removed')
    ok(!el.hasAttribute('title'), 'stale title removed')
    eq(el.getAttribute('loading'), 'true', 'runtime attribute preserved')
})

test('a changed tag name replaces the node', function() {
    var host = mk('<div>x</div>')
    var d = host.firstChild
    morphInner(host, '<span>x</span>')
    ok(host.firstChild !== d, 'node replaced')
    eq(host.firstChild.tagName, 'SPAN', 'new tag')
    eq(host.childNodes.length, 1, 'no leftovers')
})

test('keyed rows survive a reorder', function() {
    var host = mk('<div key="a">A</div><div key="b">B</div><div key="c">C</div>')
    var a = host.children[0], b = host.children[1], c = host.children[2]

    morphInner(host, '<div key="c">C</div><div key="a">A</div><div key="b">B</div>')

    eq(host.children.length, 3, 'row count')
    ok(host.children[0] === c, 'C moved, same node')
    ok(host.children[1] === a, 'A moved, same node')
    ok(host.children[2] === b, 'B moved, same node')
})

test('keyed insert leaves existing rows alone', function() {
    var host = mk('<div key="a">A</div><div key="b">B</div>')
    var a = host.children[0], b = host.children[1]

    morphInner(host, '<div key="z">Z</div><div key="a">A</div><div key="b">B</div>')

    eq(host.children.length, 3, 'row count')
    eq(host.children[0].textContent, 'Z', 'new row first')
    ok(host.children[1] === a, 'A untouched')
    ok(host.children[2] === b, 'B untouched')
})

test('keyed removal drops only the missing row', function() {
    var host = mk('<div key="a">A</div><div key="b">B</div><div key="c">C</div>')
    var a = host.children[0], b = host.children[1], c = host.children[2]

    morphInner(host, '<div key="a">A</div><div key="c">C</div>')

    eq(host.children.length, 2, 'row count')
    ok(host.children[0] === a, 'A kept')
    ok(host.children[1] === c, 'C kept')
    ok(b.parentNode === null, 'B detached')
})

test('unkeyed append reuses the leading nodes', function() {
    var host = mk('<p>a</p><p>b</p>')
    var pa = host.children[0], pb = host.children[1]
    morphInner(host, '<p>a</p><p>b</p><p>c</p>')
    eq(host.children.length, 3, 'count')
    ok(host.children[0] === pa, 'a reused')
    ok(host.children[1] === pb, 'b reused')
    eq(host.children[2].textContent, 'c', 'c appended')
})

test('focused input keeps focus and typed text', function() {
    var host = mk('<div><input id="f1" value="typed"></div>')
    var input = host.querySelector('#f1')
    input.focus()
    if (document.activeElement !== input) throw new Error('SKIP — headless did not grant focus')
    input.value = 'user typing'

    morphInner(host, '<div><input id="f1" value="typed"></div>')

    ok(document.activeElement === input, 'focus retained')
    eq(input.value, 'user typing', 'in-progress text retained')
})

test('unfocused input is synced to the server value', function() {
    var host = mk('<div><input id="f2" value="a"></div>')
    var i2 = host.querySelector('#f2')
    i2.value = 'stale'
    morphInner(host, '<div><input id="f2" value="b"></div>')
    ok(host.querySelector('#f2') === i2, 'input identity')
    eq(i2.value, 'b', 'value synced')
})

test('checkbox state follows the server when unfocused', function() {
    var host = mk('<input id="c1" type="checkbox">')
    var c1 = host.querySelector('#c1')
    eq(c1.checked, false, 'starts unchecked')
    morphInner(host, '<input id="c1" type="checkbox" checked>')
    ok(host.querySelector('#c1') === c1, 'identity')
    eq(c1.checked, true, 'checked synced')
})

test('a changed script is replaced so it can run again', function() {
    var host = mk('')
    var s = document.createElement('script')
    s.textContent = 'var morphTestValue = 1'
    host.appendChild(s)

    morphInner(host, '<scr' + 'ipt>var morphTestValue = 2</scr' + 'ipt>')

    ok(host.firstChild !== s, 'script node replaced')
    eq(host.firstChild.textContent, 'var morphTestValue = 2', 'new body')
})

test('an unchanged script is left in place', function() {
    var host = mk('')
    var s = document.createElement('script')
    s.textContent = 'var morphTestValue = 1'
    host.appendChild(s)

    morphInner(host, '<scr' + 'ipt>var morphTestValue = 1</scr' + 'ipt>')

    ok(host.firstChild === s, 'script node reused')
})

test('stale binding uuids are released in one batched request', function() {
    var host = mk('<div id="b1" on-click="/!/lp/bind?uuid=OLD1"></div><div id="b2" on-click="/!/lp/bind?uuid=OLD2"></div>')
    host.querySelector('#b1').setAttribute('lp-uuid', 'OLD1')
    host.querySelector('#b2').setAttribute('lp-uuid', 'OLD2')

    fetchCalls.length = 0
    morphInner(host, '<div id="b1" on-click="/!/lp/bind?uuid=NEW1"></div><div id="b2" on-click="/!/lp/bind?uuid=NEW2"></div>')

    eq(fetchCalls.length, 1, 'one request for the whole pass')
    eq(fetchCalls[0].url, '/!/lp/bind/u/', 'unregister endpoint')
    var uuids = fetchCalls[0].body.uuids.slice().sort()
    eq(uuids.join(','), 'OLD1,OLD2', 'both stale uuids released')
    eq(host.querySelector('#b1').getAttribute('lp-uuid'), 'NEW1', 'b1 adopted the new uuid')
    eq(host.querySelector('#b2').getAttribute('lp-uuid'), 'NEW2', 'b2 adopted the new uuid')
})

test('an unchanged binding releases nothing', function() {
    var host = mk('<div id="b3" on-click="/!/lp/bind?uuid=SAME"></div>')
    host.querySelector('#b3').setAttribute('lp-uuid', 'SAME')
    fetchCalls.length = 0
    morphInner(host, '<div id="b3" on-click="/!/lp/bind?uuid=SAME"></div>')
    eq(fetchCalls.length, 0, 'no request')
})

test('a reactive chunk morphs without touching its siblings', function() {
    var host = mk('')
    host.innerHTML = 'PRE<!--START_CHUNK@u1--><p>a</p><p>b</p><!--END_CHUNK@u1-->POST'
    var ps = host.querySelectorAll('p')
    var pa = ps[0], pb = ps[1]
    var pre = host.firstChild

    var chunk = findChunkComments('u1')
    ok(chunk != null, 'chunk comments located')

    morphChunk(chunk.start, chunk.end, '<p>a</p><p>CHANGED</p>')

    var after = host.querySelectorAll('p')
    eq(after.length, 2, 'still two paragraphs')
    ok(after[0] === pa, 'first paragraph reused')
    ok(after[1] === pb, 'second paragraph reused')
    eq(pb.textContent, 'CHANGED', 'changed text applied')
    ok(host.firstChild === pre, 'text before the chunk untouched')
    eq(host.lastChild.nodeValue, 'POST', 'text after the chunk untouched')
})

test('a chunk that grows and shrinks stays inside its boundaries', function() {
    var host = mk('')
    host.innerHTML = 'PRE<!--START_CHUNK@u2--><p>a</p><!--END_CHUNK@u2-->POST'
    var chunk = findChunkComments('u2')

    morphChunk(chunk.start, chunk.end, '<p>a</p><p>b</p><p>c</p>')
    eq(host.querySelectorAll('p').length, 3, 'grew to three')
    eq(host.lastChild.nodeValue, 'POST', 'trailing text still last')

    morphChunk(chunk.start, chunk.end, '<p>only</p>')
    eq(host.querySelectorAll('p').length, 1, 'shrank to one')
    eq(host.querySelector('p').textContent, 'only', 'content correct')
    eq(host.firstChild.nodeValue, 'PRE', 'leading text intact')
    eq(host.lastChild.nodeValue, 'POST', 'trailing text intact')
})

test('hud-preserve opts a subtree out', function() {
    var host = mk('<div hud-preserve><span>keep</span></div>')
    var sp = host.firstChild.firstChild
    morphInner(host, '<div hud-preserve><span>changed</span></div>')
    eq(sp.textContent, 'keep', 'subtree left alone')
})

test('window.HUD_MORPH = false falls back to a cold swap', function() {
    var host = mk('<p>x</p>')
    var p = host.firstChild
    window.HUD_MORPH = false
    try {
        morphInner(host, '<p>x</p>')
        ok(host.firstChild !== p, 'node was replaced, not morphed')
    } finally {
        window.HUD_MORPH = true
    }
})

test('a start marker is never morphed into an end marker', function() {
    var a = document.createComment('START_CHUNK@x')
    var b = document.createComment('END_CHUNK@x')
    ok(!isSoftMatch(a, b), 'markers of different kinds do not match')
    ok(isSoftMatch(a, document.createComment('START_CHUNK@y')), 'same kind matches')
})

test('table rows parse in the right context', function() {
    var host = mk('')
    var table = document.createElement('table')
    var tbody = document.createElement('tbody')
    tbody.innerHTML = '<tr><td>1</td></tr>'
    table.appendChild(tbody)
    host.appendChild(table)
    var tr = tbody.firstChild

    morphInner(tbody, '<tr><td>1</td></tr><tr><td>2</td></tr>')

    eq(tbody.children.length, 2, 'two rows')
    ok(tbody.children[0] === tr, 'existing row reused')
    eq(tbody.children[1].textContent, '2', 'new row content')
})


//
//
// Async Tests
//
//


// These need hud-core's MutationObserver to have run.

var asyncTests = []
function atest(name, fn) { asyncTests.push({ name: name, fn: fn }) }
function tick(ms) { return new Promise(function(r) { setTimeout(r, ms || 0) }) }

// Counts action dispatches without going near the network.
function captureActions(fn) {
    var saved = fetchDataAndUpdate
    var calls = []
    fetchDataAndUpdate = function(event, url) { calls.push(url) }
    try { fn() } finally { fetchDataAndUpdate = saved }
    return calls
}

atest('a repositioned row is not unregistered', async function() {
    var host = mk('<div key="a" on-click="/!/lp/bind?uuid=UA">A</div><div key="b" on-click="/!/lp/bind?uuid=UB">B</div>')
    await tick(30)
    var b = host.children[1]

    fetchCalls.length = 0
    morphInner(host, '<div key="b" on-click="/!/lp/bind?uuid=UB">B</div><div key="a" on-click="/!/lp/bind?uuid=UA">A</div>')
    await tick(30)

    ok(host.children[0] === b, 'B moved into first place as the same node')

    var released = fetchCalls
        .filter(function(c) { return c.url === '/!/lp/bind/u/' })
        .reduce(function(acc, c) { return acc.concat(c.body.uuids) }, [])

    ok(released.indexOf('UB') === -1, 'the moved row kept its binding')
    ok(released.indexOf('UA') === -1, 'the stationary row kept its binding')
})

atest('a repositioned row fires its action exactly once', async function() {
    var host = mk('<div key="x" on-click="/!/lp/bind?uuid=UX">X</div><div key="y" on-click="/!/lp/bind?uuid=UY">Y</div>')
    await tick(30)
    var y = host.children[1]

    morphInner(host, '<div key="y" on-click="/!/lp/bind?uuid=UY">Y</div><div key="x" on-click="/!/lp/bind?uuid=UX">X</div>')
    await tick(30)

    var calls = captureActions(function() {
        y.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    eq(calls.length, 1, 'one dispatch, not two')
    eq(calls[0], '/!/lp/bind?uuid=UY', 'against its own endpoint')
})

atest('a surviving node fires its current endpoint, not the one it was bound with', async function() {
    var host = mk('<div id="e1" on-click="/!/lp/bind?uuid=FIRST">e</div>')
    await tick(30)
    var e = host.querySelector('#e1')

    morphInner(host, '<div id="e1" on-click="/!/lp/bind?uuid=SECOND">e</div>')
    ok(host.querySelector('#e1') === e, 'same node')

    var calls = captureActions(function() {
        e.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    eq(calls.length, 1, 'fired once')
    eq(calls[0], '/!/lp/bind?uuid=SECOND', 'used the endpoint it now carries')
})

atest('a node that gains an on-* attribute gets wired up', async function() {
    var host = mk('<div id="g1">g</div>')
    await tick(30)
    var g = host.querySelector('#g1')

    morphInner(host, '<div id="g1" on-click="/!/lp/bind?uuid=GAINED">g</div>')

    ok(host.querySelector('#g1') === g, 'same node')
    eq(g.getAttribute('lp-uuid'), 'GAINED', 'binding uuid derived from the endpoint')

    var calls = captureActions(function() {
        g.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    eq(calls.length, 1, 'the gained action fired')
    eq(calls[0], '/!/lp/bind?uuid=GAINED', 'against the gained endpoint')
})

atest('a node that loses its on-* attribute stops firing', async function() {
    var host = mk('<div id="d1" on-click="/!/lp/bind?uuid=DROP">d</div>')
    await tick(30)
    var d = host.querySelector('#d1')

    morphInner(host, '<div id="d1">d</div>')

    var calls = captureActions(function() {
        d.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    eq(calls.length, 0, 'no action fired')
})

atest('a genuinely new node is still wired up by the observer', async function() {
    var host = mk('<div key="k1">one</div>')
    await tick(30)

    morphInner(host, '<div key="k1">one</div><div key="k2" on-click="/!/lp/bind?uuid=NEWNODE">two</div>')
    await tick(30)

    var fresh = host.children[1]
    eq(fresh.getAttribute('lp-uuid'), 'NEWNODE', 'observer wired the new node')

    var calls = captureActions(function() {
        fresh.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    eq(calls.length, 1, 'new node fires once')
})


// Report
async function report() {
    for (var i = 0; i < asyncTests.length; i++) {
        try { await asyncTests[i].fn(); results.push({ name: asyncTests[i].name, pass: true }) }
        catch (e) { results.push({ name: asyncTests[i].name, pass: false, error: e.message }) }
    }

    var passed = results.filter(function(r) { return r.pass }).length
    var failed = results.filter(function(r) { return !r.pass })
    var out = document.getElementById('out')
    out.textContent = 'PASS ' + passed + '/' + results.length +
        (failed.length ? ' || FAILURES: ' + failed.map(function(r) { return r.name + ' [' + r.error + ']' }).join(' ;; ') : '')
}

report()
