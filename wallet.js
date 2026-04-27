// ═══════════════════════════════════════════════
//  WALLET / BASE MAINNET
// ═══════════════════════════════════════════════
const BASE_CHAIN = {
  chainId: '0x2105', // 8453
  chainName: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org']
};

let ethProvider = null, ethSigner = null, walletAddr = '';

// Entry gate config
// GAS_ONLY = user only pays Base gas by signing a 0 ETH transaction to self.
// CONTRACT = user calls your deployed contract startGame() and can also pay entry fee.
const ENTRY_MODE = 'GAS_ONLY'; // change to 'CONTRACT' after your contract is deployed
const ENTRY_FEE_ETH = '0';     // example for CONTRACT mode: '0.0001'
const CONTRACT_ADDRESS = '';   // paste deployed Base Mainnet contract address here
const CONTRACT_ABI = [
  'function startGame() payable'
];

let isEntering = false;
let lastEntryTxHash = '';

async function connectWallet() {
  if (!window.ethereum) {
    alert('Please install MetaMask or Coinbase Wallet!');
    return false;
  }
  try {
    ethProvider = new ethers.BrowserProvider(window.ethereum);
    await ethProvider.send('eth_requestAccounts', []);

    // Switch to / add Base mainnet
    try {
      await window.ethereum.request({ method:'wallet_switchEthereumChain', params:[{chainId:BASE_CHAIN.chainId}] });
    } catch(e) {
      if (e.code === 4902) {
        await window.ethereum.request({ method:'wallet_addEthereumChain', params:[BASE_CHAIN] });
      }
    }

    ethSigner  = await ethProvider.getSigner();
    walletAddr = await ethSigner.getAddress();
    const bal  = await ethProvider.getBalance(walletAddr);
    const eth  = parseFloat(ethers.formatEther(bal)).toFixed(4);

    document.getElementById('connect-btn').style.display = 'none';
    const wi = document.getElementById('wallet-info');
    wi.style.display = 'block';
    document.getElementById('wallet-addr').textContent =
      walletAddr.slice(0,6)+'…'+walletAddr.slice(-4);
    document.getElementById('wallet-bal').textContent = eth + ' ETH';
    return true;

  } catch(e) {
    console.error(e);
    alert('Wallet error: ' + (e.shortMessage || e.message || e));
    return false;
  }
}

function setEntryButton(text, disabled=false) {
  const btn = document.getElementById('start-btn');
  if (btn) {
    btn.textContent = text;
    btn.disabled = disabled;
    btn.style.opacity = disabled ? '0.55' : '1';
    btn.style.cursor = disabled ? 'not-allowed' : 'pointer';
  }
  const cbtn = document.getElementById('connect-btn');
  if (cbtn) {
    cbtn.textContent = disabled ? 'Processing...' : 'Connect Wallet';
    cbtn.disabled = disabled;
    cbtn.style.opacity = disabled ? '0.55' : '1';
  }
}

async function enterGameFlow() {
  if (isEntering || gameState === 'ready' || gameState === 'playing' || gameState === 'dying') return;

  try {
    isEntering = true;
    setEntryButton('CONNECTING...', true);

    const connected = await connectWallet();
    if (!connected) throw new Error('Wallet not connected');

    setEntryButton('CONFIRM TX...', true);
    showOverlayScore('Confirm transaction in wallet...');

    const receipt = await payEntryTransaction();

    if (!receipt || receipt.status !== 1) {
      throw new Error('Transaction failed or not confirmed');
    }

    lastEntryTxHash = receipt.hash;
    showOverlayScore('Entry confirmed on Base ✓');
    setEntryButton('STARTING...', true);

    setTimeout(() => {
      isEntering = false;
      setEntryButton('▶ PLAY AGAIN', false);
      startGame();
    }, 650);

  } catch (e) {
    console.error(e);
    isEntering = false;
    showOverlayScore('Entry cancelled / failed');
    setEntryButton('▶ CONNECT & ENTER', false);
    alert('Entry failed: ' + (e.shortMessage || e.reason || e.message || e));
  }
}

async function payEntryTransaction() {
  if (!ethSigner) throw new Error('Signer not ready');

  await window.ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: BASE_CHAIN.chainId }]
  });

  if (ENTRY_MODE === 'CONTRACT') {
    if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS.length < 42) {
      throw new Error('CONTRACT_ADDRESS is empty. Deploy your contract first or use GAS_ONLY mode.');
    }

    const gameContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, ethSigner);
    const tx = await gameContract.startGame({
      value: ethers.parseEther(ENTRY_FEE_ETH)
    });

    showOverlayScore('Confirming on Base... ' + shortTx(tx.hash));
    return await tx.wait();
  }

  // Gas-only gate: sends 0 ETH to the player's own wallet.
  const tx = await ethSigner.sendTransaction({
    to: walletAddr,
    value: 0n
  });

  showOverlayScore('Confirming on Base... ' + shortTx(tx.hash));
  return await tx.wait();
}

function shortTx(hash) {
  if (!hash) return '';
  return hash.slice(0, 6) + '…' + hash.slice(-4);
}

function showOverlayScore(text) {
  const el = document.getElementById('ov-score');
  if (!el) return;
  el.style.display = 'block';
  el.textContent = text;
}
