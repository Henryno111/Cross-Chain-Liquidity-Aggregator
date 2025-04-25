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