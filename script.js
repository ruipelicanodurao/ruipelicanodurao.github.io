const BASE = [
  { id: 'P1', name: 'Compilador', burst: 9, ioEvery: 3, ioLeft: 0, cpuUsed: 0, quantumUsed: 0, state: 'ready', priority: 'Alta' },
  { id: 'P2', name: 'Editor', burst: 7, ioEvery: 2, ioLeft: 0, cpuUsed: 0, quantumUsed: 0, state: 'ready', priority: 'Média' },
  { id: 'P3', name: 'Browser', burst: 8, ioEvery: 4, ioLeft: 0, cpuUsed: 0, quantumUsed: 0, state: 'ready', priority: 'Baixa' },
  { id: 'P4', name: 'Backup', burst: 6, ioEvery: 3, ioLeft: 0, cpuUsed: 0, quantumUsed: 0, state: 'ready', priority: 'Média' },
  { id: 'P5', name: 'Antivírus', burst: 5, ioEvery: 99, ioLeft: 0, cpuUsed: 0, quantumUsed: 0, state: 'ready', priority: 'Alta' }
];

const state = {
  tick: 0,
  busy: 0,
  switches: 0,
  paused: false,
  done: 0,
  quantum: 1,
  timer: null,
  processes: structuredClone(BASE)
};

const els = {
  procTable: document.getElementById('procTable'),
  readyQueue: document.getElementById('readyQueue'),
  runningQueue: document.getElementById('runningQueue'),
  waitingQueue: document.getElementById('waitingQueue'),
  doneQueue: document.getElementById('doneQueue'),
  tickValue: document.getElementById('tickValue'),
  cpuValue: document.getElementById('cpuValue'),
  switchValue: document.getElementById('switchValue'),
  waitingValue: document.getElementById('waitingValue'),
  doneValue: document.getElementById('doneValue'),
  timeline: document.getElementById('timeline'),
  flowToken: document.getElementById('flowToken'),
  flowCaption: document.getElementById('flowCaption'),
  toggleBtn: document.getElementById('toggleBtn'),
  resetBtn: document.getElementById('resetBtn')
};

function tagClass(s) {
  return s === 'running' ? 'running' : s === 'waiting' ? 'waiting' : s === 'done' ? 'done' : 'ready';
}

function statusLabel(s) {
  return s === 'running' ? 'Running' : s === 'waiting' ? 'Waiting' : s === 'done' ? 'Done' : 'Ready';
}

function addEvent(msg) {
  const div = document.createElement('div');
  div.className = 'timeline-item';
  div.innerHTML = `<strong>t${state.tick}</strong> — ${msg}`;
  els.timeline.prepend(div);

  while (els.timeline.children.length > 10) {
    els.timeline.removeChild(els.timeline.lastChild);
  }
}

function setFlow(step, caption) {
  const pos = {
    ready: '16px',
    running: '36%',
    waiting: '69%',
    done: 'calc(100% - 40px)'
  };

  els.flowToken.style.left = pos[step];
  els.flowToken.classList.toggle('waiting', step === 'waiting');
  els.flowToken.classList.toggle('done', step === 'done');
  els.flowCaption.textContent = caption;
}

function renderQueues() {
  ['readyQueue', 'runningQueue', 'waitingQueue', 'doneQueue'].forEach(k => els[k].innerHTML = '');

  state.processes.forEach(p => {
    const span = document.createElement('span');
    span.className = `pill ${tagClass(p.state)}`;
    span.textContent = `${p.id}`;

    const map = {
      ready: els.readyQueue,
      running: els.runningQueue,
      waiting: els.waitingQueue,
      done: els.doneQueue
    };

    map[p.state].appendChild(span);
  });
}

function renderTable() {
  els.procTable.innerHTML = '';

  state.processes.forEach(p => {
    const remaining = Math.max(p.burst - p.cpuUsed, 0);
    const progress = Math.round((p.cpuUsed / p.burst) * 100);
    const tr = document.createElement('tr');

    if (p.state === 'running') tr.classList.add('active-row');

    tr.innerHTML = `
      <td>
        <div class="proc">
          <strong>${p.id} · ${p.name}</strong>
          <span class="muted">PCB lógico da simulação</span>
        </div>
      </td>
      <td><span class="tag ${tagClass(p.state)}">${statusLabel(p.state)}</span></td>
      <td>${p.priority}</td>
      <td>${p.burst}</td>
      <td>${p.cpuUsed}</td>
      <td>${remaining}</td>
      <td>${p.quantumUsed}/${state.quantum}</td>
      <td>${p.ioLeft}</td>
      <td>
        <div class="bar" style="--w:${progress}%"><span></span></div>
      </td>
    `;

    els.procTable.appendChild(tr);
  });
}

function renderKpis() {
  els.tickValue.textContent = state.tick;
  els.switchValue.textContent = state.switches;
  els.doneValue.textContent = state.done;
  els.waitingValue.textContent = state.processes.filter(p => p.state === 'waiting').length;
  els.cpuValue.textContent = (state.tick ? Math.round((state.busy / state.tick) * 100) : 0) + '%';
}

function render() {
  renderTable();
  renderQueues();
  renderKpis();
}

function schedule() {
  if (state.processes.some(p => p.state === 'running')) return;

  const next = state.processes.find(p => p.state === 'ready');
  if (!next) return;

  next.state = 'running';
  next.quantumUsed = 0;
  state.switches += 1;

  addEvent(`${next.id} foi selecionado pelo dispatcher e entrou em execução.`);
  setFlow('running', `${next.id} saiu de Ready e entrou em Running.`);
}

function advanceWaiting() {
  state.processes
    .filter(p => p.state === 'waiting')
    .forEach(p => {
      p.ioLeft -= 1;

      if (p.ioLeft <= 0) {
        p.ioLeft = 0;
        p.state = 'ready';
        addEvent(`${p.id} concluiu E/S e regressou à fila Ready.`);
        setFlow('ready', `${p.id} terminou a espera por E/S e voltou a Ready.`);
      }
    });
}

function runCpu() {
  const p = state.processes.find(x => x.state === 'running');
  if (!p) return;

  state.busy += 1;
  p.cpuUsed += 1;
  p.quantumUsed += 1;

  if (p.cpuUsed >= p.burst) {
    p.state = 'done';
    state.done += 1;
    addEvent(`${p.id} concluiu o burst total e foi terminado.`);
    setFlow('done', `${p.id} passou para Done depois de concluir a execução.`);
    return;
  }

  if (p.cpuUsed % p.ioEvery === 0) {
    p.state = 'waiting';
    p.ioLeft = 2;
    p.quantumUsed = 0;
    addEvent(`${p.id} pediu E/S e transitou para Waiting.`);
    setFlow('waiting', `${p.id} ficou bloqueado à espera de E/S.`);
    return;
  }

  if (p.quantumUsed >= state.quantum) {
    p.state = 'ready';
    p.quantumUsed = 0;
    addEvent(`${p.id} esgotou o quantum e regressou a Ready.`);
    setFlow('ready', `${p.id} voltou à fila Ready após usar o quantum.`);
  }
}

function loop() {
  if (state.paused) return;

  state.tick += 1;
  advanceWaiting();
  schedule();
  runCpu();
  schedule();
  render();

  if (state.processes.every(p => p.state === 'done')) {
    addEvent('Todos os processos foram concluídos; reinício automático da dashboard.');
    clearInterval(state.timer);
    setTimeout(reset, 1800);
  }
}

function reset() {
  state.tick = 0;
  state.busy = 0;
  state.switches = 0;
  state.done = 0;
  state.processes = structuredClone(BASE);
  els.timeline.innerHTML = '';
  render();
  addEvent('Dashboard reiniciada com todos os processos em Ready.');
  setFlow('ready', 'A simulação começou com processos disponíveis na fila Ready.');
  clearInterval(state.timer);
  state.timer = setInterval(loop, 1450);
}

els.toggleBtn.addEventListener('click', () => {
  state.paused = !state.paused;
  els.toggleBtn.textContent = state.paused ? 'Retomar' : 'Pausar';
  addEvent(state.paused ? 'Simulação em pausa.' : 'Simulação retomada.');
});

els.resetBtn.addEventListener('click', reset);

(function themeToggle() {
  const btn = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;

  btn.addEventListener('click', () => {
    root.setAttribute('data-theme', root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });
})();

reset();

const syncState = {
  appStep: 0,
  hwStep: 0,
  osStep: 0,
  appBuffer: 0,
  osFrames: [
    { running: ['T1 mutex owner'], waiting: ['T2 futex wait', 'T3 sem_wait'], wake: [], kernel: 'futex wait', caption: 'Duas threads ficam bloqueadas no kernel enquanto T1 está na secção crítica.' },
    { running: ['T1 unlock'], waiting: ['T3 sem_wait'], wake: ['T2 wake-up'], kernel: 'wake one', caption: 'O sistema operativo acorda uma thread quando o mutex é libertado.' },
    { running: ['T2 running'], waiting: ['T3 cond_wait'], wake: ['evento I/O'], kernel: 'scheduler dispatch', caption: 'Após o wake-up, o escalonador coloca a thread acordada em execução.' },
    { running: ['T2 signal'], waiting: [], wake: ['T3 ready'], kernel: 'signal / broadcast', caption: 'Um evento ou signal desperta outra thread adormecida na fila de espera.' }
  ],
  hwFrames: [
    { owner: 1, spinners: [2,3], label: 'LOCK=1 · test-and-set', caption: 'T1 obtém o lock com uma operação atómica; T2 e T3 ficam em spin.' },
    { owner: 2, spinners: [3], sleeping: [1], label: 'LOCK=1 · compare-and-swap', caption: 'Após libertação, T2 vence o compare-and-swap e entra na secção crítica.' },
    { owner: 3, spinners: [1,2], label: 'LOCK=1 · spinlock', caption: 'Em secções curtas, as outras threads fazem busy waiting à volta do lock.' },
    { owner: 0, spinners: [], label: 'LOCK=0 · unlocked', caption: 'O lock atómico é libertado e volta a estar disponível.' }
  ]
};

function renderBufferSlots() {
  const wrap = document.getElementById('bufferSlots');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (let i = 0; i < 4; i += 1) {
    const slot = document.createElement('div');
    slot.className = 'buffer-slot' + (i < syncState.appBuffer ? ' filled' : '');
    slot.textContent = i < syncState.appBuffer ? 'item' : 'vazio';
    wrap.appendChild(slot);
  }
  const empty = document.getElementById('emptyCount');
  const full = document.getElementById('fullCount');
  if (empty) empty.textContent = String(4 - syncState.appBuffer);
  if (full) full.textContent = String(syncState.appBuffer);
}

function animateApplicationSync() {
  const producer = document.getElementById('producerToken');
  const consumer = document.getElementById('consumerToken');
  const mutex = document.getElementById('mutexIndicator');
  const caption = document.getElementById('appSyncCaption');
  if (!producer || !consumer || !mutex || !caption) return;

  syncState.appStep = (syncState.appStep + 1) % 4;
  producer.classList.remove('waiting');
  consumer.classList.remove('waiting');

  if (syncState.appStep === 0) {
    syncState.appBuffer = Math.min(syncState.appBuffer + 1, 4);
    producer.style.left = 'calc(100% - 54px)';
    consumer.style.left = '14px';
    mutex.textContent = 'Mutex locked';
    mutex.className = 'lock-indicator locked';
    caption.textContent = 'O produtor entra na secção crítica, usa o mutex e coloca um item no buffer.';
  } else if (syncState.appStep === 1) {
    producer.style.left = '14px';
    consumer.style.left = '14px';
    consumer.classList.add('waiting');
    mutex.textContent = 'Semáforo sincroniza';
    mutex.className = 'lock-indicator unlocked';
    caption.textContent = 'Se não houver itens suficientes, o consumidor espera pelo semáforo full.';
  } else if (syncState.appStep === 2) {
    syncState.appBuffer = Math.max(syncState.appBuffer - 1, 0);
    producer.style.left = '14px';
    consumer.style.left = 'calc(100% - 54px)';
    mutex.textContent = 'Mutex locked';
    mutex.className = 'lock-indicator locked';
    caption.textContent = 'O consumidor obtém o mutex, retira um item e liberta espaço no buffer.';
  } else {
    producer.style.left = '14px';
    consumer.style.left = '14px';
    mutex.textContent = 'Mutex livre';
    mutex.className = 'lock-indicator unlocked';
    caption.textContent = 'Aplicações combinam mutex e semáforos para exclusão mútua e coordenação.';
  }

  renderBufferSlots();
}

function animateHardwareSync() {
  const n1 = document.getElementById('hwCpu1');
  const n2 = document.getElementById('hwCpu2');
  const n3 = document.getElementById('hwCpu3');
  const stateLabel = document.getElementById('hwLockState');
  const caption = document.getElementById('hwSyncCaption');
  if (!n1 || !n2 || !n3 || !stateLabel || !caption) return;

  const nodes = {1: n1, 2: n2, 3: n3};
  Object.values(nodes).forEach(node => node.className = 'cpu-node contender');

  const frame = syncState.hwFrames[syncState.hwStep];
  if (frame.owner) nodes[frame.owner].classList.add('active');
  (frame.spinners || []).forEach(i => nodes[i].classList.add('spinning'));
  (frame.sleeping || []).forEach(i => nodes[i].classList.add('sleeping'));
  stateLabel.textContent = frame.label;
  caption.textContent = frame.caption;
  syncState.hwStep = (syncState.hwStep + 1) % syncState.hwFrames.length;
}

function renderOsQueue(id, items, cls) {
  const box = document.getElementById(id);
  if (!box) return;
  box.innerHTML = '';
  items.forEach(text => {
    const div = document.createElement('div');
    div.className = 'thread-pill ' + cls;
    div.textContent = text;
    box.appendChild(div);
  });
}

function animateOsSync() {
  const kernel = document.getElementById('osKernelState');
  const caption = document.getElementById('osSyncCaption');
  if (!kernel || !caption) return;

  const frame = syncState.osFrames[syncState.osStep];
  renderOsQueue('osRunning', frame.running, 'running');
  renderOsQueue('osSleeping', frame.waiting, 'waiting');
  renderOsQueue('osWake', frame.wake, 'wakeup');
  kernel.textContent = frame.kernel;
  caption.textContent = frame.caption;
  syncState.osStep = (syncState.osStep + 1) % syncState.osFrames.length;
}

function startSyncAnimations() {
  renderBufferSlots();
  animateApplicationSync();
  animateHardwareSync();
  animateOsSync();
  setInterval(animateApplicationSync, 1800);
  setInterval(animateHardwareSync, 2200);
  setInterval(animateOsSync, 2600);
}

startSyncAnimations();