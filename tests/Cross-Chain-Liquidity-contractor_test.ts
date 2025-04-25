;; Cross-Chain Liquidity Aggregator Tests
;; A test suite for testing the cross-chain liquidity aggregator contract

(use-trait ft-trait .sip-010-trait.sip-010-trait)

;; Mock contracts for testing
(define-trait mock-adapter-trait
  (
    (lock-funds (string-ascii 20) uint principal principal (response bool uint))
    (release-funds (string-ascii 20) uint principal principal (response bool uint))
  )
)

(define-trait mock-oracle-trait
  (
    (get-price (string-ascii 20) (response uint uint))
  )
)

;; Test constants
(define-constant contract-owner tx-sender)
(define-constant test-user 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5)
(define-constant test-relayer 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG)
(define-constant test-treasury 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC)
(define-constant test-recipient 'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB)

;; Error constants for test assertions
(define-constant err-tx-failed u999)
(define-constant err-test-failed u998)

;; Test setup
(define-public (setup-environment)
  (begin
    ;; Initialize the main contract
    (try! (contract-call? .cross-chain-liquidity-aggregator initialize test-treasury))
    
    ;; Register test chains
    (try! (contract-call? .cross-chain-liquidity-aggregator register-chain 
      "stacks" "Stacks Blockchain" .mock-stacks-adapter u1 u600 "STX" "native" u1000 u10))
    (try! (contract-call? .cross-chain-liquidity-aggregator register-chain 
      "bitcoin" "Bitcoin" .mock-bitcoin-adapter u6 u600 "BTC" "native" u5000 u20))
    (try! (contract-call? .cross-chain-liquidity-aggregator register-chain 
      "ethereum" "Ethereum" .mock-ethereum-adapter u12 u15 "ETH" "bridged" u8000 u15))
    
    ;; Register test pools
    (try! (contract-call? .cross-chain-liquidity-aggregator register-pool 
      "stacks" "stx" .mock-stx-token u1000000 u1000000000 u30))
    (try! (contract-call? .cross-chain-liquidity-aggregator register-pool 
      "stacks" "xbtc" .mock-xbtc-token u100000 u1000000000 u40))
    (try! (contract-call? .cross-chain-liquidity-aggregator register-pool 
      "bitcoin" "btc" .mock-btc-token u10000 u1000000000 u20))
    (try! (contract-call? .cross-chain-liquidity-aggregator register-pool 
      "ethereum" "eth" .mock-eth-token u500000 u1000000000 u25))
    (try! (contract-call? .cross-chain-liquidity-aggregator register-pool 
      "ethereum" "wbtc" .mock-wbtc-token u100000 u1000000000 u35))
    
    ;; Setup token mappings
    (try! (contract-call? .cross-chain-liquidity-aggregator map-token
      "stacks" "xbtc" "bitcoin" "btc"))
    (try! (contract-call? .cross-chain-liquidity-aggregator map-token
      "bitcoin" "btc" "ethereum" "wbtc"))
    (try! (contract-call? .cross-chain-liquidity-aggregator map-token
      "stacks" "stx" "ethereum" "eth"))
    
    ;; Register oracles
    (try! (contract-call? .cross-chain-liquidity-aggregator register-oracle
      "stacks" "stx" .mock-stx-oracle u144 u300))
    (try! (contract-call? .cross-chain-liquidity-aggregator register-oracle
      "stacks" "xbtc" .mock-xbtc-oracle u144 u300))
    (try! (contract-call? .cross-chain-liquidity-aggregator register-oracle
      "bitcoin" "btc" .mock-btc-oracle u144 u300))
    (try! (contract-call? .cross-chain-liquidity-aggregator register-oracle
      "ethereum" "eth" .mock-eth-oracle u144 u300))
    (try! (contract-call? .cross-chain-liquidity-aggregator register-oracle
      "ethereum" "wbtc" .mock-wbtc-oracle u144 u300))
    
    ;; Authorize test relayer
    (try! (contract-call? .cross-chain-liquidity-aggregator authorize-relayer
      test-relayer (list "stacks" "bitcoin" "ethereum")))
    
    ;; Set initial prices
    (as-contract (try! (contract-call? .mock-stx-oracle set-mock-price "stx" u1000000)))
    (as-contract (try! (contract-call? .mock-xbtc-oracle set-mock-price "xbtc" u2500000000)))
    (as-contract (try! (contract-call? .mock-btc-oracle set-mock-price "btc" u2500000000)))
    (as-contract (try! (contract-call? .mock-eth-oracle set-mock-price "eth" u15000000)))
    (as-contract (try! (contract-call? .mock-wbtc-oracle set-mock-price "wbtc" u2500000000)))
    
    ;; Update prices in main contract
    (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator update-price "stacks" "stx" u1000000)))
    (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator update-price "stacks" "xbtc" u2500000000)))
    (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator update-price "bitcoin" "btc" u2500000000)))
    (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator update-price "ethereum" "eth" u15000000)))
    (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator update-price "ethereum" "wbtc" u2500000000)))
    
    ;; Add initial liquidity
    (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator add-liquidity "stacks" "stx" u1000000000)))
    (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator add-liquidity "stacks" "xbtc" u10000000)))
    (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator add-liquidity "bitcoin" "btc" u1000000)))
    (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator add-liquidity "ethereum" "eth" u10000000)))
    (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator add-liquidity "ethereum" "wbtc" u1000000)))
    
    (ok true)
  )
)

;; Test chain registration
(define-public (test-chain-registration)
  (begin
    ;; Test successful registration
    (try! (contract-call? .cross-chain-liquidity-aggregator register-chain 
      "solana" "Solana" .mock-solana-adapter u1 u500 "SOL" "bridged" u2000 u15))
    
    ;; Test chain exists error
    (asserts! (is-err (contract-call? .cross-chain-liquidity-aggregator register-chain 
      "solana" "Solana Duplicate" .mock-solana-adapter u1 u500 "SOL" "bridged" u2000 u15)) 
      err-test-failed)
    
    ;; Test unauthorized access
    (asserts! (is-err (as-contract (contract-call? .cross-chain-liquidity-aggregator register-chain 
      "avalanche" "Avalanche" .mock-avalanche-adapter u1 u2 "AVAX" "bridged" u3000 u15)))
      err-test-failed)
    
    ;; Verify chain was added correctly
    (let ((chain (contract-call? .cross-chain-liquidity-aggregator get-chain "solana")))
      (asserts! (is-some chain) err-test-failed)
      (asserts! (is-eq (get name (unwrap-panic chain)) "Solana") err-test-failed)
    )
    
    (ok true)
  )
)

;; Test pool registration
(define-public (test-pool-registration)
  (begin
    ;; Register a new pool
    (try! (contract-call? .cross-chain-liquidity-aggregator register-pool 
      "solana" "sol" .mock-sol-token u200000 u100000000 u30))
    
    ;; Test pool exists error
    (asserts! (is-err (contract-call? .cross-chain-liquidity-aggregator register-pool 
      "solana" "sol" .mock-sol-token u200000 u100000000 u30))
      err-test-failed)
    
    ;; Test unauthorized access
    (asserts! (is-err (as-contract (contract-call? .cross-chain-liquidity-aggregator register-pool 
      "solana" "usdc" .mock-usdc-token u100000 u10000000 u20)))
      err-test-failed)
    
    ;; Test invalid parameters (min > max)
    (asserts! (is-err (contract-call? .cross-chain-liquidity-aggregator register-pool 
      "solana" "usdc" .mock-usdc-token u10000000 u100000 u20))
      err-test-failed)
    
    ;; Verify pool was added correctly
    (let ((pool (contract-call? .cross-chain-liquidity-aggregator get-pool "solana" "sol")))
      (asserts! (is-some pool) err-test-failed)
      (asserts! (is-eq (get token-contract (unwrap-panic pool)) .mock-sol-token) err-test-failed)
      (asserts! (is-eq (get fee-bp (unwrap-panic pool)) u30) err-test-failed)
    )
    
    (ok true)
  )
)

;; Test token mapping
(define-public (test-token-mapping)
  (begin
    ;; Create mappings
    (try! (contract-call? .cross-chain-liquidity-aggregator map-token
      "stacks" "stx" "solana" "sol"))
    
    ;; Verify mappings
    (let (
      (forward-mapping (contract-call? .cross-chain-liquidity-aggregator get-token-mapping "stacks" "stx" "solana"))
      (reverse-mapping (contract-call? .cross-chain-liquidity-aggregator get-token-mapping "solana" "sol" "stacks"))
    )
      (asserts! (is-some forward-mapping) err-test-failed)
      (asserts! (is-eq (get target-token (unwrap-panic forward-mapping)) "sol") err-test-failed)
      (asserts! (is-some reverse-mapping) err-test-failed)
      (asserts! (is-eq (get target-token (unwrap-panic reverse-mapping)) "stx") err-test-failed)
    )
    
    (ok true)
  );; Cross-Chain Liquidity Aggregator Tests
  ;; A test suite for testing the cross-chain liquidity aggregator contract
  
  (use-trait ft-trait .sip-010-trait.sip-010-trait)
  
  ;; Mock contracts for testing
  (define-trait mock-adapter-trait
    (
      (lock-funds (string-ascii 20) uint principal principal (response bool uint))
      (release-funds (string-ascii 20) uint principal principal (response bool uint))
    )
  )
  
  (define-trait mock-oracle-trait
    (
      (get-price (string-ascii 20) (response uint uint))
    )
  )
  
  ;; Test constants
  (define-constant contract-owner tx-sender)
  (define-constant test-user 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5)
  (define-constant test-relayer 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG)
  (define-constant test-treasury 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC)
  (define-constant test-recipient 'ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB)
  
  ;; Error constants for test assertions
  (define-constant err-tx-failed u999)
  (define-constant err-test-failed u998)
  
  ;; Test setup
  (define-public (setup-environment)
    (begin
      ;; Initialize the main contract
      (try! (contract-call? .cross-chain-liquidity-aggregator initialize test-treasury))
      
      ;; Register test chains
      (try! (contract-call? .cross-chain-liquidity-aggregator register-chain 
        "stacks" "Stacks Blockchain" .mock-stacks-adapter u1 u600 "STX" "native" u1000 u10))
      (try! (contract-call? .cross-chain-liquidity-aggregator register-chain 
        "bitcoin" "Bitcoin" .mock-bitcoin-adapter u6 u600 "BTC" "native" u5000 u20))
      (try! (contract-call? .cross-chain-liquidity-aggregator register-chain 
        "ethereum" "Ethereum" .mock-ethereum-adapter u12 u15 "ETH" "bridged" u8000 u15))
      
      ;; Register test pools
      (try! (contract-call? .cross-chain-liquidity-aggregator register-pool 
        "stacks" "stx" .mock-stx-token u1000000 u1000000000 u30))
      (try! (contract-call? .cross-chain-liquidity-aggregator register-pool 
        "stacks" "xbtc" .mock-xbtc-token u100000 u1000000000 u40))
      (try! (contract-call? .cross-chain-liquidity-aggregator register-pool 
        "bitcoin" "btc" .mock-btc-token u10000 u1000000000 u20))
      (try! (contract-call? .cross-chain-liquidity-aggregator register-pool 
        "ethereum" "eth" .mock-eth-token u500000 u1000000000 u25))
      (try! (contract-call? .cross-chain-liquidity-aggregator register-pool 
        "ethereum" "wbtc" .mock-wbtc-token u100000 u1000000000 u35))
      
      ;; Setup token mappings
      (try! (contract-call? .cross-chain-liquidity-aggregator map-token
        "stacks" "xbtc" "bitcoin" "btc"))
      (try! (contract-call? .cross-chain-liquidity-aggregator map-token
        "bitcoin" "btc" "ethereum" "wbtc"))
      (try! (contract-call? .cross-chain-liquidity-aggregator map-token
        "stacks" "stx" "ethereum" "eth"))
      
      ;; Register oracles
      (try! (contract-call? .cross-chain-liquidity-aggregator register-oracle
        "stacks" "stx" .mock-stx-oracle u144 u300))
      (try! (contract-call? .cross-chain-liquidity-aggregator register-oracle
        "stacks" "xbtc" .mock-xbtc-oracle u144 u300))
      (try! (contract-call? .cross-chain-liquidity-aggregator register-oracle
        "bitcoin" "btc" .mock-btc-oracle u144 u300))
      (try! (contract-call? .cross-chain-liquidity-aggregator register-oracle
        "ethereum" "eth" .mock-eth-oracle u144 u300))
      (try! (contract-call? .cross-chain-liquidity-aggregator register-oracle
        "ethereum" "wbtc" .mock-wbtc-oracle u144 u300))
      
      ;; Authorize test relayer
      (try! (contract-call? .cross-chain-liquidity-aggregator authorize-relayer
        test-relayer (list "stacks" "bitcoin" "ethereum")))
      
      ;; Set initial prices
      (as-contract (try! (contract-call? .mock-stx-oracle set-mock-price "stx" u1000000)))
      (as-contract (try! (contract-call? .mock-xbtc-oracle set-mock-price "xbtc" u2500000000)))
      (as-contract (try! (contract-call? .mock-btc-oracle set-mock-price "btc" u2500000000)))
      (as-contract (try! (contract-call? .mock-eth-oracle set-mock-price "eth" u15000000)))
      (as-contract (try! (contract-call? .mock-wbtc-oracle set-mock-price "wbtc" u2500000000)))
      
      ;; Update prices in main contract
      (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator update-price "stacks" "stx" u1000000)))
      (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator update-price "stacks" "xbtc" u2500000000)))
      (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator update-price "bitcoin" "btc" u2500000000)))
      (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator update-price "ethereum" "eth" u15000000)))
      (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator update-price "ethereum" "wbtc" u2500000000)))
      
      ;; Add initial liquidity
      (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator add-liquidity "stacks" "stx" u1000000000)))
      (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator add-liquidity "stacks" "xbtc" u10000000)))
      (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator add-liquidity "bitcoin" "btc" u1000000)))
      (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator add-liquidity "ethereum" "eth" u10000000)))
      (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator add-liquidity "ethereum" "wbtc" u1000000)))
      
      (ok true)
    )
  )
  
  ;; Test chain registration
  (define-public (test-chain-registration)
    (begin
      ;; Test successful registration
      (try! (contract-call? .cross-chain-liquidity-aggregator register-chain 
        "solana" "Solana" .mock-solana-adapter u1 u500 "SOL" "bridged" u2000 u15))
      
      ;; Test chain exists error
      (asserts! (is-err (contract-call? .cross-chain-liquidity-aggregator register-chain 
        "solana" "Solana Duplicate" .mock-solana-adapter u1 u500 "SOL" "bridged" u2000 u15)) 
        err-test-failed)
      
      ;; Test unauthorized access
      (asserts! (is-err (as-contract (contract-call? .cross-chain-liquidity-aggregator register-chain 
        "avalanche" "Avalanche" .mock-avalanche-adapter u1 u2 "AVAX" "bridged" u3000 u15)))
        err-test-failed)
      
      ;; Verify chain was added correctly
      (let ((chain (contract-call? .cross-chain-liquidity-aggregator get-chain "solana")))
        (asserts! (is-some chain) err-test-failed)
        (asserts! (is-eq (get name (unwrap-panic chain)) "Solana") err-test-failed)
      )
      
      (ok true)
    )
  )
  
  ;; Test pool registration
  (define-public (test-pool-registration)
    (begin
      ;; Register a new pool
      (try! (contract-call? .cross-chain-liquidity-aggregator register-pool 
        "solana" "sol" .mock-sol-token u200000 u100000000 u30))
      
      ;; Test pool exists error
      (asserts! (is-err (contract-call? .cross-chain-liquidity-aggregator register-pool 
        "solana" "sol" .mock-sol-token u200000 u100000000 u30))
        err-test-failed)
      
      ;; Test unauthorized access
      (asserts! (is-err (as-contract (contract-call? .cross-chain-liquidity-aggregator register-pool 
        "solana" "usdc" .mock-usdc-token u100000 u10000000 u20)))
        err-test-failed)
      
      ;; Test invalid parameters (min > max)
      (asserts! (is-err (contract-call? .cross-chain-liquidity-aggregator register-pool 
        "solana" "usdc" .mock-usdc-token u10000000 u100000 u20))
        err-test-failed)
      
      ;; Verify pool was added correctly
      (let ((pool (contract-call? .cross-chain-liquidity-aggregator get-pool "solana" "sol")))
        (asserts! (is-some pool) err-test-failed)
        (asserts! (is-eq (get token-contract (unwrap-panic pool)) .mock-sol-token) err-test-failed)
        (asserts! (is-eq (get fee-bp (unwrap-panic pool)) u30) err-test-failed)
      )
      
      (ok true)
    )
  )
  
  ;; Test token mapping
  (define-public (test-token-mapping)
    (begin
      ;; Create mappings
      (try! (contract-call? .cross-chain-liquidity-aggregator map-token
        "stacks" "stx" "solana" "sol"))
      
      ;; Verify mappings
      (let (
        (forward-mapping (contract-call? .cross-chain-liquidity-aggregator get-token-mapping "stacks" "stx" "solana"))
        (reverse-mapping (contract-call? .cross-chain-liquidity-aggregator get-token-mapping "solana" "sol" "stacks"))
      )
        (asserts! (is-some forward-mapping) err-test-failed)
        (asserts! (is-eq (get target-token (unwrap-panic forward-mapping)) "sol") err-test-failed)
        (asserts! (is-some reverse-mapping) err-test-failed)
        (asserts! (is-eq (get target-token (unwrap-panic reverse-mapping)) "stx") err-test-failed)
      )
      
      (ok true)
    )
  )
  
  ;; Test adding liquidity
  (define-public (test-add-liquidity)
    (begin
      ;; Add liquidity as user
      (try! (contract-call? .mock-stx-token mint u5000000 test-user))
      
      ;; Approve contract to transfer tokens
      (as-contract (try! (contract-call? .mock-stx-token approve .cross-chain-liquidity-aggregator u5000000 none)))
      
      ;; Add liquidity
      (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator add-liquidity "stacks" "stx" u5000000)))
      
      ;; Verify liquidity was added
      (let (
        (pool (unwrap! (contract-call? .cross-chain-liquidity-aggregator get-pool "stacks" "stx") err-test-failed))
        (provider (contract-call? .cross-chain-liquidity-aggregator get-liquidity-provider "stacks" "stx" contract-owner))
      )
        (asserts! (>= (get available-liquidity pool) u5000000) err-test-failed)
        (asserts! (is-some provider) err-test-failed)
        (asserts! (>= (get liquidity-amount (unwrap-panic provider)) u5000000) err-test-failed)
      )
      
      ;; Test adding liquidity to inactive pool
      (try! (contract-call? .cross-chain-liquidity-aggregator set-pool-status "solana" "sol" false))
      (asserts! (is-err (as-contract (contract-call? .cross-chain-liquidity-aggregator add-liquidity "solana" "sol" u5000000)))
        err-test-failed)
      
      (ok true)
    )
  )
  
  ;; Test removing liquidity
  (define-public (test-remove-liquidity)
    (begin
      ;; Add liquidity first
      (try! (contract-call? .mock-stx-token mint u10000000 test-user))
      (as-contract (try! (contract-call? .mock-stx-token approve .cross-chain-liquidity-aggregator u10000000 none)))
      (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator add-liquidity "stacks" "stx" u10000000)))
      
      ;; Remove liquidity
      (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator remove-liquidity "stacks" "stx" u5000000)))
      
      ;; Verify liquidity was removed
      (let (
        (pool (unwrap! (contract-call? .cross-chain-liquidity-aggregator get-pool "stacks" "stx") err-test-failed))
        (provider (unwrap! (contract-call? .cross-chain-liquidity-aggregator get-liquidity-provider "stacks" "stx" contract-owner) err-test-failed))
      )
        (asserts! (is-some (get last-withdrawal-block provider)) err-test-failed)
        (asserts! (<= (get liquidity-amount provider) u5000000) err-test-failed)
      )
      
      ;; Test removing more than provided
      (asserts! (is-err (as-contract (contract-call? .cross-chain-liquidity-aggregator remove-liquidity "stacks" "stx" u100000000)))
        err-test-failed)
      
      (ok true)
    )
  )
  
  ;; Test finding optimal route
  (define-public (test-find-optimal-route)
    (begin
      ;; Find route from stacks stx to ethereum eth
      (let ((route-result (try! (contract-call? .cross-chain-liquidity-aggregator find-optimal-route 
        "stacks" "stx" u10000000 "ethereum" "eth"))))
        (asserts! (> (get route-id route-result) u0) err-test-failed)
        (asserts! (> (get estimated-output route-result) u0) err-test-failed)
        
        ;; Verify cached route
        (let ((cached-route (unwrap! (contract-call? .cross-chain-liquidity-aggregator get-cached-route (get route-id route-result)) err-test-failed)))
          (asserts! (is-eq (get source-chain cached-route) "stacks") err-test-failed)
          (asserts! (is-eq (get target-chain cached-route) "ethereum") err-test-failed)
        )
      )
      
      ;; Test invalid route
      (asserts! (is-err (contract-call? .cross-chain-liquidity-aggregator find-optimal-route 
        "stacks" "fake-token" u10000000 "ethereum" "eth"))
        err-test-failed)
      
      (ok true)
    )
  )
  
  ;; Test cross-chain swap full flow
  (define-public (test-cross-chain-swap)
    (begin
      ;; Add sufficient liquidity
      (try! (contract-call? .mock-stx-token mint u100000000 test-user))
      (try! (contract-call? .mock-eth-token mint u10000000 test-user))
      (as-contract (try! (contract-call? .mock-stx-token approve .cross-chain-liquidity-aggregator u100000000 none)))
      (as-contract (try! (contract-call? .mock-eth-token approve .cross-chain-liquidity-aggregator u10000000 none)))
      (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator add-liquidity "stacks" "stx" u100000000)))
      (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator add-liquidity "ethereum" "eth" u10000000)))
      
      ;; Initialize variables for swap
      (let (
        (swap-amount u5000000)
        (hash-lock (sha256 0x12345678))
        (preimage 0x12345678)
        (execution-path (list 
          { chain: "stacks", token: "stx", pool: .mock-stx-token }
          { chain: "ethereum", token: "eth", pool: .mock-eth-token }
        ))
      )
        ;; Initiate swap
        (let ((swap-result (try! (as-contract (contract-call? .cross-chain-liquidity-aggregator initiate-cross-chain-swap 
          "stacks" "stx" swap-amount
          "ethereum" "eth" test-recipient
          hash-lock execution-path u50)))))
          
          ;; Verify swap was created
          (let ((swap-id (get swap-id swap-result)))
            (asserts! (> swap-id u0) err-test-failed)
            
            ;; Check swap details
            (let ((swap (unwrap! (contract-call? .cross-chain-liquidity-aggregator get-swap swap-id) err-test-failed)))
              (asserts! (is-eq (get status swap) u0) err-test-failed) ;; Pending
              (asserts! (is-eq (get initiator swap) contract-owner) err-test-failed)
              (asserts! (is-eq (get recipient swap) test-recipient) err-test-failed)
              
              ;; Execute swap
              (let ((execute-result (try! (as-contract (contract-call? .cross-chain-liquidity-aggregator execute-cross-chain-swap 
                swap-id preimage)))))
                
                ;; Verify swap was executed
                (let ((updated-swap (unwrap! (contract-call? .cross-chain-liquidity-aggregator get-swap swap-id) err-test-failed)))
                  (asserts! (is-eq (get status updated-swap) u1) err-test-failed) ;; Completed
                  (asserts! (is-some (get completion-block updated-swap)) err-test-failed)
                  (asserts! (is-eq (unwrap-panic (get preimage updated-swap)) preimage) err-test-failed)
                )
              )
            )
          )
        )
        
        ;; Test timeout and refund
        (let (
          (new-swap-result (try! (as-contract (contract-call? .cross-chain-liquidity-aggregator initiate-cross-chain-swap 
            "stacks" "stx" swap-amount
            "ethereum" "eth" test-recipient
            hash-lock execution-path u50))))
          (let ((new-swap-id (get swap-id new-swap-result)))
            ;; Simulate time passing (would normally use block-height)
            (try! (as-contract (contract-call? .test-utils advance-chain-tip (var-get .cross-chain-liquidity-aggregator default-timeout-blocks))))
            
            ;; Refund swap
            (try! (as-contract (contract-call? .cross-chain-liquidity-aggregator refund-swap new-swap-id)))
            
            ;; Verify swap was refunded
            (let ((updated-swap (unwrap! (contract-call? .cross-chain-liquidity-aggregator get-swap new-swap-id) err-test-failed)))
              (asserts! (is-eq (get status updated-swap) u2) err-test-failed) ;; Refunded
            )
          )
        )
      )
      
      (ok true)
    )
  )
  
  ;; Test emergency shutdown
  (define-public (test-emergency-shutdown)
    (begin
      ;; Enable emergency shutdown
      (try! (contract-call? .cross-chain-liquidity-aggregator set-emergency-shutdown true))
      
      ;; Verify params
      (let ((params (contract-call? .cross-chain-liquidity-aggregator get-protocol-parameters)))
        (asserts! (get emergency-shutdown params) err-test-failed)
      )
      
      ;; Test operations during shutdown
      (asserts! (is-err (as-contract (contract-call? .cross-chain-liquidity-aggregator initiate-cross-chain-swap 
        "stacks" "stx" u1000000
        "ethereum" "eth" test-recipient
        (sha256 0x12345678) 
        (list 
          { chain: "stacks", token: "stx", pool: .mock-stx-token }
          { chain: "ethereum", token: "eth", pool: .mock-eth-token }
        ) 
        u50)))
        err-test-failed)
      
      ;; Disable emergency shutdown
      (try! (contract-call? .cross-chain-liquidity-aggregator set-emergency-shutdown false))
      
      ;; Verify params
      (let ((params (contract-call? .cross-chain-liquidity-aggregator get-protocol-parameters)))
        (asserts! (not (get emergency-shutdown params)) err-test-failed)
      )
      
      (ok true)
    )
  )
  
  ;; Test relayer operations
  (define-public (test-relayer-operations)
    (begin
      ;; Add stake as relayer
      (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator stake-as-relayer u10000000)))
      
      ;; Verify stake
      (let ((relayer-info (unwrap! (contract-call? .cross-chain-liquidity-aggregator get-relayer contract-owner) err-test-failed)))
        (asserts! (>= (get stake-amount relayer-info) u10000000) err-test-failed)
      )
      
      ;; Test unstake
      (as-contract (try! (contract-call? .cross-chain-liquidity-aggregator unstake-as-relayer u5000000)))
      
      ;; Verify stake reduced
      (let ((relayer-info (unwrap! (contract-call? .cross-chain-liquidity-aggregator get-relayer contract-owner) err-test-failed)))
        (asserts! (<= (get stake-amount relayer-info) u5000000) err-test-failed)
      )
      
      ;; Test unstake more than staked
      (asserts! (is-err (as-contract (contract-call? .cross-chain-liquidity-aggregator unstake-as-relayer u100000000)))
        err-test-failed)
      
      (ok true)
    )
  )
  
  ;; Test protocol parameter updates
  (define-public (test-protocol-parameter-updates)
    (begin
      ;; Update protocol fee
      (try! (contract-call? .cross-chain-liquidity-aggregator set-protocol-fee u50))
      
      ;; Update max slippage
      (try! (contract-call? .cross-chain-liquidity-aggregator set-max-slippage u200))
      
      ;; Update treasury address
      (try! (contract-call? .cross-chain-liquidity-aggregator set-treasury-address test-treasury))
      
      ;; Verify parameter updates
      (let ((params (contract-call? .cross-chain-liquidity-aggregator get-protocol-parameters)))
        (asserts! (is-eq (get protocol-fee-bp params) u50) err-test-failed)
        (asserts! (is-eq (get max-slippage-bp params) u200) err-test-failed)
        (asserts! (is-eq (get treasury-address params) test-treasury) err-test-failed)
      )
      
      ;; Test invalid parameters
      (asserts! (is-err (contract-call? .cross-chain-liquidity-aggregator set-protocol-fee u1000))
        err-test-failed)
      
      (ok true)
    )
  )
  
  ;; Test chain and pool status updates
  (define-public (test-status-updates)
    (begin
      ;; Update chain status
      (try! (contract-call? .cross-chain-liquidity-aggregator set-chain-status "ethereum" false u1))
      
      ;; Verify chain status
      (let ((chain (unwrap! (contract-call? .cross-chain-liquidity-aggregator get-chain "ethereum") err-test-failed)))
        (asserts! (not (get enabled chain)) err-test-failed)
        (asserts! (is-eq (get status chain) u1) err-test-failed)
        (asserts! (is-eq (contract-call? .cross-chain-liquidity-aggregator get-chain-status-string "ethereum") "Paused") err-test-failed)
      )
      
      ;; Update pool status
      (try! (contract-call? .cross-chain-liquidity-aggregator set-pool-status "ethereum" "eth" false))
      
      ;; Verify pool status
      (let ((pool (unwrap! (contract-call? .cross-chain-liquidity-aggregator get-pool "ethereum" "eth") err-test-failed)))
        (asserts! (not (get active pool)) err-test-failed)
      )
      
      (ok true)
    )
  )
  
  ;; Run all tests
  (define-public (run-all-tests)
    (begin
      (try! (setup-environment))
      (try! (test-chain-registration))
      (try! (test-pool-registration))
      (try! (test-token-mapping))
      (try! (test-add-liquidity))
      (try! (test-remove-liquidity))
      (try! (test-find-optimal-route))
      (try! (test-cross-chain-swap))
      (try! (test-emergency-shutdown))
      (try! (test-relayer-operations))
      (try! (test-protocol-parameter-updates))
      (try! (test-status-updates))
      
      (ok "All tests passed!")
    )
  )
  
  ;; Mock implementations needed for tests
  
  ;; Mock adapter contracts
  (define-public (mock-lock-funds (token-id (string-ascii 20)) (amount uint) (sender principal) (recipient principal))
    (ok true)
  )
  
  (define-public (mock-release-funds (token-id (string-ascii 20)) (amount uint) (sender principal) (recipient principal))
    (ok true)
  )
  
  ;; Mock oracle contracts
  (define-public (mock-get-price (token-id (string-ascii 20)))
    (ok u1000000) ;; Default price
  )
  
  (define-public (set-mock-price (token-id (string-ascii 20)) (price uint))
    (ok price)
  )
  
  ;; Test utilities
  (define-data-var chain-tip uint block-height)
  
  (define-public (advance-chain-tip (blocks uint))
    (begin
      (var-set chain-tip (+ (var-get chain-tip) blocks))
      (ok (var-get chain-tip))
    )
  )
)