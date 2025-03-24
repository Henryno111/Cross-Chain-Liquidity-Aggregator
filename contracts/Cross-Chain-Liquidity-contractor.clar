 Cross-Chain Liquidity Aggregator
;; A protocol that aggregates liquidity from multiple chains using Bitcoin and Stacks as a settlement layer

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-authorized (err u101))
(define-constant err-chain-exists (err u102))
(define-constant err-chain-not-found (err u103))
(define-constant err-pool-exists (err u104))
(define-constant err-pool-not-found (err u105))
(define-constant err-insufficient-funds (err u106))
(define-constant err-invalid-parameters (err u107))
(define-constant err-timeout-not-reached (err u108))
(define-constant err-timeout-expired (err u109))
(define-constant err-swap-already-claimed (err u110))
(define-constant err-swap-not-found (err u111))
(define-constant err-invalid-path (err u112))
(define-constant err-invalid-signature (err u113))
(define-constant err-slippage-too-high (err u114))
(define-constant err-oracle-not-found (err u115))
(define-constant err-price-deviation (err u116))
(define-constant err-insufficient-liquidity (err u117))
(define-constant err-invalid-fee (err u118))
(define-constant err-invalid-preimage (err u119))
(define-constant err-relayer-not-found (err u120))
(define-constant err-invalid-route (err u121))
(define-constant err-emergency-shutdown (err u122))
(define-constant err-already-executed (err u123))
(define-constant err-inactive-pool (err u124))

;; Protocol parameters
(define-data-var next-swap-id uint u1)
(define-data-var next-route-id uint u1)
(define-data-var protocol-fee-bp uint u25) ;; 0.25% fee in basis points
(define-data-var max-slippage-bp uint u100) ;; 1% maximum slippage allowed
(define-data-var min-liquidity uint u1000000) ;; 1 STX minimum liquidity
(define-data-var default-timeout-blocks uint u144) ;; ~24 hours (144 blocks/day)
(define-data-var max-route-hops uint u3) ;; maximum hops in a route
(define-data-var treasury-address principal contract-owner)
(define-data-var emergency-shutdown bool false)
(define-data-var price-deviation-threshold uint u200) ;; 2% threshold for price oracle deviation
(define-data-var relayer-reward-percentage uint u10) ;; 10% of protocol fee goes to relayers

;; Stacks token for protocol governance
(define-fungible-token xchain-token)

;; Chain status enumeration
;; 0 = Active, 1 = Paused, 2 = Deprecated
(define-data-var chain-statuses (list 3 (string-ascii 10)) (list "Active" "Paused" "Deprecated"))

;; Swap status enumeration
;; 0 = Pending, 1 = Completed, 2 = Refunded, 3 = Expired
(define-data-var swap-statuses (list 4 (string-ascii 10)) (list "Pending" "Completed" "Refunded" "Expired"))

;; Supported blockchains
(define-map chains
  { chain-id: (string-ascii 20) }
  {
    name: (string-ascii 40),
    adapter-contract: principal,
    status: uint,
    confirmation-blocks: uint,
    block-time: uint, ;; Average block time in seconds
    chain-token: (string-ascii 10), ;; Chain's native token symbol
    btc-connection-type: (string-ascii 20), ;; "native", "wrapped", "bridged"
    enabled: bool,
    base-fee: uint, ;; Base fee for transactions on this chain
    fee-multiplier: uint, ;; Dynamic fee multiplier
    last-updated: uint
  }
)

;; Liquidity pools
(define-map liquidity-pools
  { chain-id: (string-ascii 20), token-id: (string-ascii 20) }
  {
    token-contract: principal,
    total-liquidity: uint,
    available-liquidity: uint,
    committed-liquidity: uint,
    min-swap-amount: uint,
    max-swap-amount: uint,
    fee-bp: uint, ;; Fee in basis points
    active: bool,
    last-volume-24h: uint,
    cumulative-volume: uint,
    cumulative-fees: uint,
    last-price: uint, ;; Last price in STX
    creation-block: uint,
    last-updated: uint
  }
)

;; Token mappings across chains
(define-map token-mappings
  { source-chain: (string-ascii 20), source-token: (string-ascii 20), target-chain: (string-ascii 20) }
  { target-token: (string-ascii 20) }
)

;; Cross-chain swaps
(define-map swaps
  { swap-id: uint }
  {
    initiator: principal,
    source-chain: (string-ascii 20),
    source-token: (string-ascii 20),
    source-amount: uint,
    target-chain: (string-ascii 20),
    target-token: (string-ascii 20),
    target-amount: uint,
    recipient: principal,
    timeout-block: uint,
    hash-lock: (buff 32),
    preimage: (optional (buff 32)),
    status: uint,
    execution-path: (list 5 { chain: (string-ascii 20), token: (string-ascii 20), pool: principal }),
    max-slippage-bp: uint,
    protocol-fee: uint,
    relayer-fee: uint,
    relayer: (optional principal),
    creation-block: uint,
    completion-block: (optional uint),
    ref-hash: (string-ascii 64) ;; Reference hash for cross-chain tracking
  }
)

;; Price oracles for tokens
(define-map price-oracles
  { chain-id: (string-ascii 20), token-id: (string-ascii 20) }
  {
    oracle-contract: principal,
    last-price: uint, ;; In STX with 8 decimal precision
    last-updated: uint,
    heartbeat: uint, ;; Maximum time between updates in blocks
    deviation-threshold: uint, ;; Max allowed deviation in basis points
    trusted: bool
  }
)

;; Authorized relayers
(define-map relayers
  { relayer: principal }
  {
    authorized: bool,
    stake-amount: uint,
    transactions-processed: uint,
    cumulative-fees-earned: uint,
    last-active: uint,
    accuracy-score: uint, ;; 0-100 score
    specialized-chains: (list 10 (string-ascii 20))
  }
)

;; Optimal routes cache
(define-map route-cache
  { route-id: uint }
  {
    source-chain: (string-ascii 20),
    source-token: (string-ascii 20),
    target-chain: (string-ascii 20),
    target-token: (string-ascii 20),
    path: (list 5 { chain: (string-ascii 20), token: (string-ascii 20), pool: principal }),
    estimated-output: uint,
    estimated-fees: uint,
    timestamp: uint,
    expiry: uint,
    gas-estimate: uint
  }
)

;; Liquidity provider records
(define-map liquidity-providers
  { chain-id: (string-ascii 20), token-id: (string-ascii 20), provider: principal }
  {
    liquidity-amount: uint,
    rewards-earned: uint,
    last-deposit-block: uint,
    last-withdrawal-block: (optional uint)
  }
)

;; Initialize contract
(define-public (initialize (treasury principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set treasury-address treasury)
    (var-set protocol-fee-bp u25) ;; 0.25%
    (var-set max-slippage-bp u100) ;; 1%
    (var-set min-liquidity u1000000) ;; 1 STX
    (var-set default-timeout-blocks u144) ;; ~24 hours
    (var-set emergency-shutdown false)
    
    ;; Mint initial protocol tokens
    (try! (ft-mint? xchain-token u1000000000000 treasury))
    
    (ok true)
  )
)

;; Register a new blockchain
(define-public (register-chain
  (chain-id (string-ascii 20))
  (name (string-ascii 40))
  (adapter-contract principal)
  (confirmation-blocks uint)
  (block-time uint)
  (chain-token (string-ascii 10))
  (btc-connection-type (string-ascii 20))
  (base-fee uint)
  (fee-multiplier uint))
  
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (is-none (map-get? chains { chain-id: chain-id })) err-chain-exists)
    
    ;; Validate parameters
    (asserts! (> confirmation-blocks u0) err-invalid-parameters)
    (asserts! (> block-time u0) err-invalid-parameters)
    (asserts! (or (is-eq btc-connection-type "native") 
                (is-eq btc-connection-type "wrapped") 
                (is-eq btc-connection-type "bridged")) 
              err-invalid-parameters)
    
    ;; Create chain record
    (map-set chains
      { chain-id: chain-id }
      {
        name: name,
        adapter-contract: adapter-contract,
        status: u0, ;; Active
        confirmation-blocks: confirmation-blocks,
        block-time: block-time,
        chain-token: chain-token,
        btc-connection-type: btc-connection-type,
        enabled: true,
        base-fee: base-fee,
        fee-multiplier: fee-multiplier,
        last-updated: block-height
      }
    )
    
    (ok chain-id)
  )
)

;; Register a liquidity pool
(define-public (register-pool
  (chain-id (string-ascii 20))
  (token-id (string-ascii 20))
  (token-contract principal)
  (min-swap-amount uint)
  (max-swap-amount uint)
  (fee-bp uint))
  
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (is-some (map-get? chains { chain-id: chain-id })) err-chain-not-found)
    (asserts! (is-none (map-get? liquidity-pools { chain-id: chain-id, token-id: token-id })) err-pool-exists)
    
    ;; Validate parameters
    (asserts! (< min-swap-amount max-swap-amount) err-invalid-parameters)
    (asserts! (<= fee-bp u1000) err-invalid-parameters) ;; Maximum 10% fee
    
    ;; Create pool record
    (map-set liquidity-pools
      { chain-id: chain-id, token-id: token-id }
      {
        token-contract: token-contract,
        total-liquidity: u0,
        available-liquidity: u0,
        committed-liquidity: u0,
        min-swap-amount: min-swap-amount,
        max-swap-amount: max-swap-amount,
        fee-bp: fee-bp,
        active: true,
        last-volume-24h: u0,
        cumulative-volume: u0,
        cumulative-fees: u0,
        last-price: u0,
        creation-block: block-height,
        last-updated: block-height
      }
    )
       (ok { chain: chain-id, token: token-id })
  )
)

;; Map a token across chains
(define-public (map-token
  (source-chain (string-ascii 20))
  (source-token (string-ascii 20))
  (target-chain (string-ascii 20))
  (target-token (string-ascii 20)))
  
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (is-some (map-get? chains { chain-id: source-chain })) err-chain-not-found)
    (asserts! (is-some (map-get? chains { chain-id: target-chain })) err-chain-not-found)
    
    ;; Create token mapping
    (map-set token-mappings
      { source-chain: source-chain, source-token: source-token, target-chain: target-chain }
      { target-token: target-token }
    )
    
    ;; Create reverse mapping
    (map-set token-mappings
      { source-chain: target-chain, source-token: target-token, target-chain: source-chain }
      { target-token: source-token }
    )
    
    (ok true)
  )
)

;; Register a price oracle
(define-public (register-oracle
  (chain-id (string-ascii 20))
  (token-id (string-ascii 20))
  (oracle-contract principal)
  (heartbeat uint)
  (deviation-threshold uint))
  
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (is-some (map-get? chains { chain-id: chain-id })) err-chain-not-found)
    
    ;; Validate parameters
    (asserts! (> heartbeat u0) err-invalid-parameters)
    (asserts! (< deviation-threshold u10000) err-invalid-parameters) ;; Max 100% deviation threshold
    
    ;; Create oracle record
    (map-set price-oracles
      { chain-id: chain-id, token-id: token-id }
      {
        oracle-contract: oracle-contract,
        last-price: u0,
        last-updated: block-height,
        heartbeat: heartbeat,
        deviation-threshold: deviation-threshold,
        trusted: true
      }
    )
      (ok { chain: chain-id, token: token-id, oracle: oracle-contract })
  )
)

;; Authorize a relayer
(define-public (authorize-relayer
  (relayer principal)
  (specialized-chains (list 10 (string-ascii 20))))
  
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    
    ;; Validate each chain exists
    (asserts! (all-chains-exist specialized-chains) err-chain-not-found)
    
    ;; Create relayer record
    (map-set relayers
      { relayer: relayer }
      {
        authorized: true,
        stake-amount: u0,
        transactions-processed: u0,
        cumulative-fees-earned: u0,
        last-active: block-height,
        accuracy-score: u80, ;; Start with 80/100 score
        specialized-chains: specialized-chains
      }
    )
    
    (ok relayer)
  )
)

;; Helper to verify all chains exist
(define-private (all-chains-exist (chain-list (list 10 (string-ascii 20))))
  (fold check-chain-exists true chain-list)
)

;; Helper to check if a chain exists
(define-private (check-chain-exists (result bool) (chain-id (string-ascii 20)))
  (and result (is-some (map-get? chains { chain-id: chain-id })))
)

;; Add liquidity to a pool
(define-public (add-liquidity
  (chain-id (string-ascii 20))
  (token-id (string-ascii 20))
  (amount uint))
  
  (let (
    (provider tx-sender)
    (pool (unwrap! (map-get? liquidity-pools { chain-id: chain-id, token-id: token-id }) err-pool-not-found))
    (chain (unwrap! (map-get? chains { chain-id: chain-id }) err-chain-not-found))
  )
    ;; Check for emergency shutdown
    (asserts! (not (var-get emergency-shutdown)) err-emergency-shutdown)
    
    ;; Validate parameters
    (asserts! (get active pool) err-inactive-pool)
    (asserts! (get enabled chain) err-chain-not-found)
    (asserts! (> amount (var-get min-liquidity)) err-invalid-parameters)
    
    ;; Transfer tokens to contract
    (if (is-eq chain-id "stacks")
      ;; For STX tokens
      (if (is-eq token-id "stx")
        (try! (stx-transfer? amount provider (as-contract tx-sender)))
        ;; For other tokens on Stacks
        (try! (contract-call? (get token-contract pool) transfer amount provider (as-contract tx-sender) none))
      )
      ;; For tokens on other chains, call adapter contract
      (try! (contract-call? (get adapter-contract chain) lock-funds token-id amount provider (as-contract tx-sender)))
    )
    
    ;; Update pool liquidity
    (map-set liquidity-pools
      { chain-id: chain-id, token-id: token-id }
      (merge pool {
        total-liquidity: (+ (get total-liquidity pool) amount),
        available-liquidity: (+ (get available-liquidity pool) amount),
        last-updated: block-height
      })
    )
    
    ;; Update liquidity provider record
    (let (
      (provider-record (default-to {
                         liquidity-amount: u0,
                         rewards-earned: u0,
                         last-deposit-block: block-height,
                         last-withdrawal-block: none
                       } (map-get? liquidity-providers { chain-id: chain-id, token-id: token-id, provider: provider })))
    )
      (map-set liquidity-providers
        { chain-id: chain-id, token-id: token-id, provider: provider }
        (merge provider-record {
          liquidity-amount: (+ (get liquidity-amount provider-record) amount),
          last-deposit-block: block-height
        })
      )
    )
    
    (ok amount)
  )
)

;; Remove liquidity from a pool
(define-public (remove-liquidity
  (chain-id (string-ascii 20))
  (token-id (string-ascii 20))
  (amount uint))
  
  (let (
    (provider tx-sender)
    (pool (unwrap! (map-get? liquidity-pools { chain-id: chain-id, token-id: token-id }) err-pool-not-found))
    (chain (unwrap! (map-get? chains { chain-id: chain-id }) err-chain-not-found))
    (provider-record (unwrap! (map-get? liquidity-providers 
                                        { chain-id: chain-id, token-id: token-id, provider: provider }) 
                              err-not-authorized))
  )
    ;; Validate parameters
    (asserts! (<= amount (get liquidity-amount provider-record)) err-insufficient-funds)
    (asserts! (<= amount (get available-liquidity pool)) err-insufficient-liquidity)
    
    ;; Update pool liquidity
    (map-set liquidity-pools
      { chain-id: chain-id, token-id: token-id }
      (merge pool {
        total-liquidity: (- (get total-liquidity pool) amount),
        available-liquidity: (- (get available-liquidity pool) amount),
        last-updated: block-height
      })
    )
    
    ;; Update liquidity provider record
    (map-set liquidity-providers
      { chain-id: chain-id, token-id: token-id, provider: provider }
      (merge provider-record {
        liquidity-amount: (- (get liquidity-amount provider-record) amount),
        last-withdrawal-block: (some block-height)
      })
    )
    
    ;; Transfer tokens back to provider
    (if (is-eq chain-id "stacks")
      ;; For STX tokens
      (if (is-eq token-id "stx")
        (as-contract (try! (stx-transfer? amount (as-contract tx-sender) provider)))
        ;; For other tokens on Stacks
        (as-contract (try! (contract-call? (get token-contract pool) transfer amount (as-contract tx-sender) provider none)))
      )
      ;; For tokens on other chains, call adapter contract
      (as-contract (try! (contract-call? (get adapter-contract chain) release-funds token-id amount (as-contract tx-sender) provider)))
    )
    
    (ok amount)
  )
)
;; Initiate a cross-chain swap
(define-public (initiate-cross-chain-swap
  (source-chain (string-ascii 20))
  (source-token (string-ascii 20))
  (source-amount uint)
  (target-chain (string-ascii 20))
  (target-token (string-ascii 20))
  (recipient principal)
  (hash-lock (buff 32))
  (execution-path (list 5 { chain: (string-ascii 20), token: (string-ascii 20), pool: principal }))
  (slippage-bp uint))
  
  (let (
    (initiator tx-sender)
    (swap-id (var-get next-swap-id))
    (timeout-block (+ block-height (var-get default-timeout-blocks)))
    (routing-valid (validate-execution-path source-chain source-token target-chain target-token execution-path))
  )
    ;; Check for emergency shutdown
    (asserts! (not (var-get emergency-shutdown)) err-emergency-shutdown)
    
    ;; Validate parameters
    (asserts! (is-ok routing-valid) err-invalid-path)
    (asserts! (<= slippage-bp (var-get max-slippage-bp)) err-invalid-parameters)
    (asserts! (not (is-eq source-chain target-chain)) err-invalid-parameters) ;; Must be cross-chain
    
    ;; Check source chain and token exist
    (let (
      (source-pool (unwrap! (map-get? liquidity-pools { chain-id: source-chain, token-id: source-token }) err-pool-not-found))
      (source-chain-info (unwrap! (map-get? chains { chain-id: source-chain }) err-chain-not-found))
      (estimated-output (unwrap! (get-estimated-output source-chain source-token source-amount target-chain target-token) err-invalid-route))
    )
      ;; Validate swap amount
      (asserts! (>= source-amount (get min-swap-amount source-pool)) err-invalid-parameters)
      (asserts! (<= source-amount (get max-swap-amount source-pool)) err-invalid-parameters)
      (asserts! (<= source-amount (get available-liquidity source-pool)) err-insufficient-liquidity)
      
      ;; Calculate fees
      (let (
        (protocol-fee (/ (* source-amount (var-get protocol-fee-bp)) u10000))
        (pool-fee (/ (* source-amount (get fee-bp source-pool)) u10000))
        (relayer-fee (/ (* protocol-fee (var-get relayer-reward-percentage)) u100))
        (total-fee (+ protocol-fee pool-fee))
        (net-amount (- source-amount total-fee))
        (ref-hash (generate-ref-hash swap-id hash-lock block-height))
      )
        ;; Lock source tokens in contract
        (if (is-eq source-chain "stacks")
          ;; For STX tokens
          (if (is-eq source-token "stx")
            (try! (stx-transfer? source-amount initiator (as-contract tx-sender)))
            ;; For other tokens on Stacks
            (try! (contract-call? (get token-contract source-pool) transfer source-amount initiator (as-contract tx-sender) none))
          )
          ;; For tokens on other chains, call adapter contract
          (try! (contract-call? (get adapter-contract source-chain-info) lock-funds source-token source-amount initiator (as-contract tx-sender)))
        )
        
        ;; Update available liquidity
        (map-set liquidity-pools
          { chain-id: source-chain, token-id: source-token }
          (merge source-pool {
            available-liquidity: (- (get available-liquidity source-pool) net-amount),
            committed-liquidity: (+ (get committed-liquidity source-pool) net-amount),
            cumulative-volume: (+ (get cumulative-volume source-pool) source-amount),
            cumulative-fees: (+ (get cumulative-fees source-pool) pool-fee),
            last-updated: block-height
          })
        )
        
        ;; Create swap record
        (map-set swaps
          { swap-id: swap-id }
          {
            initiator: initiator,
            source-chain: source-chain,
            source-token: source-token,
            source-amount: source-amount,
            target-chain: target-chain,
            target-token: target-token,
            target-amount: estimated-output,
            recipient: recipient,
            timeout-block: timeout-block,
            hash-lock: hash-lock,
            preimage: none,
            status: u0, ;; Pending
            execution-path: execution-path,
            max-slippage-bp: slippage-bp,
            protocol-fee: protocol-fee,
            relayer-fee: relayer-fee,
            relayer: none,
            creation-block: block-height,
            completion-block: none,
            ref-hash: ref-hash
          }
        )
        
        ;; Increment swap ID
        (var-set next-swap-id (+ swap-id u1))
        
        (ok { 
          swap-id: swap-id, 
          timeout-block: timeout-block, 
          estimated-output: estimated-output,
          ref-hash: ref-hash
        })
      )
    )
  )
)

;; Generate reference hash for cross-chain tracking
(define-private (generate-ref-hash (swap-id uint) (hash-lock (buff 32)) (block uint))
  (to-ascii (keccak256 (concat (to-consensus-buff swap-id) 
                              (concat hash-lock (to-consensus-buff block)))))
)

;; Execute a cross-chain swap with preimage
(define-public (execute-cross-chain-swap
  (swap-id uint)
  (preimage (buff 32)))
  
  (let (
    (executor tx-sender)
    (swap (unwrap! (map-get? swaps { swap-id: swap-id }) err-swap-not-found))
    (hash-lock (get hash-lock swap))
  )
    ;; Check for emergency shutdown
    (asserts! (not (var-get emergency-shutdown)) err-emergency-shutdown)
    
    ;; Validate swap state
    (asserts! (is-eq (get status swap) u0) err-already-executed) ;; Must be pending
    (asserts! (< block-height (get timeout-block swap)) err-timeout-expired) ;; Must not be expired
    
    ;; Verify preimage
    (asserts! (is-eq (sha256 preimage) hash-lock) err-invalid-preimage)
    
    ;; Check target chain and token
    (let (
      (target-chain (get target-chain swap))
      (target-token (get target-token swap))
      (target-amount (get target-amount swap))
      (recipient (get recipient swap))
      (target-pool (unwrap! (map-get? liquidity-pools { chain-id: target-chain, token-id: target-token }) err-pool-not-found))
      (target-chain-info (unwrap! (map-get? chains { chain-id: target-chain }) err-chain-not-found))
      (is-relayer (is-some (map-get? relayers { relayer: executor })))
      (slippage-bp (get max-slippage-bp swap))
    )
      ;; Check sufficient liquidity
      (asserts! (>= (get available-liquidity target-pool) target-amount) err-insufficient-liquidity)
      
      ;; Calculate minimum acceptable amount with slippage
      (let (
        (min-acceptable-amount (- target-amount (/ (* target-amount slippage-bp) u10000)))
      )
        ;; If swap is executed by a relayer, update relayer stats
        (if is-relayer
          (let (
            (relayer-record (unwrap-panic (map-get? relayers { relayer: executor })))
            (relayer-fee (get relayer-fee swap))
          )
            (map-set relayers
              { relayer: executor }
              (merge relayer-record {
                transactions-processed: (+ (get transactions-processed relayer-record) u1),
                cumulative-fees-earned: (+ (get cumulative-fees-earned relayer-record) relayer-fee),
                last-active: block-height
              })
            )
            
            ;; Update swap with relayer info
            (map-set swaps
              { swap-id: swap-id }
              (merge swap {
                relayer: (some executor)
              })
            )
            
            ;; Process relayer payment - from protocol fees
            (as-contract (try! (stx-transfer? relayer-fee (as-contract tx-sender) executor)))
          )
          true
        )
        
        ;; Release target tokens to recipient
        (if (is-eq target-chain "stacks")
          ;; For STX tokens
          (if (is-eq target-token "stx")
            (as-contract (try! (stx-transfer? target-amount (as-contract tx-sender) recipient)))
            ;; For other tokens on Stacks
            (as-contract (try! (contract-call? (get token-contract target-pool) transfer target-amount (as-contract tx-sender) recipient none)))
          )
          ;; For tokens on other chains, call adapter contract
          (as-contract (try! (contract-call? (get adapter-contract target-chain-info) release-funds target-token target-amount (as-contract tx-sender) recipient)))
        )
        
        ;; Update available liquidity
        (map-set liquidity-pools
          { chain-id: target-chain, token-id: target-token }
          (merge target-pool {
            available-liquidity: (- (get available-liquidity target-pool) target-amount),
            committed-liquidity: (+ (get committed-liquidity target-pool) target-amount),
            last-volume-24h: (+ (get last-volume-24h target-pool) target-amount),
            cumulative-volume: (+ (get cumulative-volume target-pool) target-amount),
            last-updated: block-height
          })
        )
        
        ;; Mark swap as completed
        (map-set swaps
          { swap-id: swap-id }
          (merge swap {
            status: u1, ;; Completed
            preimage: (some preimage),
            completion-block: (some block-height)
          })
        )
        
        ;; Transfer protocol fee to treasury (minus relayer fee if applicable)
        (let (
          (protocol-fee (get protocol-fee swap))
          (relayer-fee (get relayer-fee swap))
          (treasury-amount (- protocol-fee (if is-relayer relayer-fee u0)))
        )
          (as-contract (try! (stx-transfer? treasury-amount (as-contract tx-sender) (var-get treasury-address))))
        )
        
        (ok { 
          swap-id: swap-id, 
          recipient: recipient, 
          amount: target-amount,
          preimage: preimage
        })
      )
    )
  )
)
        
