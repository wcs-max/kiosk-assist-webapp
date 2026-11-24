(() => {
  const menu = [
    { name: '따뜻한 아메리카노', price: 4000, emoji: '☕', words: ['아메리카노', '아메리카노는', '아메리카노를'] },
    { name: '아이스 아메리카노', price: 4500, emoji: '🧊', words: ['아이스 아메리카노', '아이스 아메리카노는'] },
    { name: '카페라떼', price: 4800, emoji: '🥛', words: ['카페라떼', '라떼'] },
    { name: '바닐라 라떼', price: 5300, emoji: '🍦', words: ['바닐라 라떼', '바닐라라떼'] },
    { name: '레몬차', price: 4500, emoji: '🍋', words: ['레몬차'] },
    { name: '유자차', price: 4500, emoji: '🍵', words: ['유자차'] },
    { name: '카모마일 차', price: 4500, emoji: '🌼', words: ['카모마일', '캐모마일'] },
    { name: '치즈 케이크', price: 6000, emoji: '🍰', words: ['치즈 케이크', '치즈케이크'] },
  ];
  const cart = new Map();
  let connected = false;
  let paying = false;
  let recognition = null;
  let toastTimer;
  const $ = (id) => document.getElementById(id);
  const won = (amount) => `${amount.toLocaleString('ko-KR')}원`;
  const setMessage = (text, speak = false) => {
    $('recognitionText').textContent = text;
    if (speak && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.92;
      window.speechSynthesis.speak(utterance);
    }
  };
  const total = () => [...cart].reduce((sum, [index, quantity]) => sum + menu[index].price * quantity, 0);
  const count = () => [...cart.values()].reduce((sum, quantity) => sum + quantity, 0);

  function renderCart() {
    const entries = [...cart.entries()];
    $('itemCount').textContent = count();
    $('cartTotal').innerHTML = `${total().toLocaleString('ko-KR')}<span>원</span>`;
    $('phoneCartCount').textContent = `${count()}개`;
    $('payAmount').textContent = won(total());
    $('payButton').disabled = !count() || paying;
    $('phoneCartSummary').textContent = entries.length
      ? entries.map(([index, quantity]) => `${menu[index].name} ${quantity}잔`).join(' · ')
      : '주문을 시작해 보세요';
    $('paymentTotal').textContent = won(total());
    if (!entries.length) {
      $('cartList').innerHTML = '<div class="empty-cart"><span class="empty-icon">☕</span><p>아직 담긴 메뉴가 없어요</p><span>휴대폰에 대고 말씀해 주세요</span></div>';
      return;
    }
    $('cartList').innerHTML = entries.map(([index, quantity], position) => {
      const item = menu[index];
      return `<div class="cart-item ${position === entries.length - 1 ? 'highlight' : ''}"><span class="item-emoji">${item.emoji}</span><span class="item-detail"><strong>${item.name}</strong><small>${quantity}잔 · ${won(item.price)} / 잔</small></span><span class="item-price">${won(item.price * quantity)}</span></div>`;
    }).join('');
  }

  function showToast(message) {
    const toast = $('kioskToast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function addMenu(text) {
    const normalized = text.toLowerCase().replaceAll(' ', '');
    const index = menu.findIndex((item) => item.words.some((word) => normalized.includes(word.replaceAll(' ', ''))));
    if (index < 0) {
      setMessage('죄송해요, 해당 메뉴는 매장에 없습니다. 메뉴를 다시 말씀해 주세요.', true);
      showToast('인식할 수 없는 메뉴입니다');
      return false;
    }
    const quantityMatch = text.match(/(\d+|한|두|세|네|한\s*잔|두\s*잔|세\s*잔|네\s*잔)/);
    const quantityWords = { 한: 1, 두: 2, 세: 3, 네: 4 };
    const rawQuantity = quantityMatch?.[0]?.replace(/\s*잔/, '') || '1';
    const quantity = Math.max(1, Math.min(9, Number(quantityWords[rawQuantity] || rawQuantity) || 1));
    cart.set(index, (cart.get(index) || 0) + quantity);
    $('kioskWelcome').classList.add('hidden');
    $('kioskOrder').classList.remove('hidden');
    $('kioskStatus').textContent = '휴대폰 주문이 실시간 반영됐어요';
    renderCart();
    const response = `${menu[index].name} ${quantity}잔을 담았습니다.`;
    setMessage(`${menu[index].name} ${quantity}잔 추가됨`, true);
    showToast(response);
    return true;
  }

  function startPayment() {
    if (!count() || paying) return;
    paying = true;
    $('kioskWelcome').classList.add('hidden');
    $('kioskOrder').classList.add('hidden');
    $('paymentView').classList.remove('hidden');
    $('kioskStatus').textContent = '키오스크에서 카드 결제를 진행해 주세요';
    $('payButton').innerHTML = '<span>✓</span> 결제 진행 중 <b>키오스크 확인</b>';
    $('payButton').disabled = true;
    setMessage('키오스크 화면에서 카드를 넣어 주세요.', true);
  }

  function processUtterance(text) {
    $('micButton').classList.remove('listening');
    $('micCaption').textContent = '누르고 말씀하세요';
    $('recognitionBox').classList.remove('listening');
    const heard = text.trim();
    if (!heard) {
      setMessage('음성을 잘 듣지 못했어요. 다시 말씀해 주세요.');
      return;
    }
    setMessage(`인식했어요: ${heard}`);
    if (/결제|주문\s*끝|계산/.test(heard)) {
      startPayment();
    } else {
      addMenu(heard);
    }
  }

  function beginSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessage('이 브라우저에서는 음성 인식을 지원하지 않아요. 아래 메뉴 버튼을 눌러 주문해 주세요.');
      return;
    }
    recognition?.abort();
    recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      $('micButton').classList.add('listening');
      $('micCaption').textContent = '듣고 있어요… 편하게 말씀하세요';
      $('recognitionText').textContent = '말씀하시는 내용을 듣고 있어요';
    };
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((result) => result[0].transcript).join('');
      $('recognitionText').textContent = `인식 중: ${text}`;
      if (event.results[event.results.length - 1].isFinal) processUtterance(text);
    };
    recognition.onerror = (event) => {
      if (event.error !== 'aborted' && event.error !== 'no-speech') setMessage('음성을 잘 듣지 못했어요. 다시 말씀해 주세요.');
      $('micButton').classList.remove('listening');
      $('micCaption').textContent = '누르고 말씀하세요';
    };
    recognition.onend = () => {
      $('micButton').classList.remove('listening');
      $('micCaption').textContent = '누르고 말씀하세요';
    };
    try { recognition.start(); } catch (_) { setMessage('마이크를 사용할 수 없어요. 메뉴 버튼으로 주문해 주세요.'); }
  }

  $('connectButton').addEventListener('click', () => {
    if (connected) return;
    connected = true;
    $('connectButton').disabled = true;
    $('connectButton').innerHTML = '<span>✓</span> 연결됐어요';
    $('connectionText').textContent = '키오스크와 연결 완료';
    document.querySelector('.connection-label .status-dot').classList.remove('offline');
    document.querySelector('.connection-label .status-dot').classList.add('online');
    $('kioskStatus').textContent = '휴대폰과 연결됐어요';
    document.querySelector('.kiosk-footer .status-dot').classList.add('online');
    $('phoneConnect').classList.add('hidden');
    $('phoneOrder').classList.remove('hidden');
    $('kioskWelcome').classList.remove('hidden');
    setMessage('연결됐어요. 원하시는 메뉴를 말씀해 주세요.');
  });
  $('micButton').addEventListener('click', beginSpeech);
  $('payButton').addEventListener('click', startPayment);
  document.querySelectorAll('.quick-chip').forEach((button) => {
    button.addEventListener('click', () => processUtterance(button.dataset.order));
  });
  $('resetButton').addEventListener('click', () => {
    cart.clear(); connected = false; paying = false;
    $('phoneOrder').classList.add('hidden'); $('phoneConnect').classList.remove('hidden');
    $('kioskOrder').classList.add('hidden'); $('paymentView').classList.add('hidden'); $('kioskWelcome').classList.remove('hidden');
    $('connectButton').disabled = false; $('connectButton').innerHTML = '<span>⌁</span> 키오스크 연결하기';
    $('connectionText').textContent = '아직 연결되지 않았어요';
    document.querySelector('.connection-label .status-dot').classList.remove('online');
    document.querySelector('.connection-label .status-dot').classList.add('offline');
    document.querySelector('.kiosk-footer .status-dot').classList.remove('online');
    $('kioskStatus').textContent = '연결을 기다리고 있어요';
    $('payButton').innerHTML = '<span>💳</span> 결제하기 <b id="payAmount">0원</b>';
    renderCart(); setMessage('예: 따뜻한 아메리카노 한 잔');
  });
  renderCart();
})();
