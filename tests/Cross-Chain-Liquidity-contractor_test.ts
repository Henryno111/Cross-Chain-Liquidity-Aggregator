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
  )
)
