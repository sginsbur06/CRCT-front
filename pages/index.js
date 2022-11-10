import React, { Component } from 'react'
import { ethers } from 'ethers'

import { ConnectWallet } from '../components/ConnectWallet'
import { WaitingForTransactionMessage } from '../components/WaitingForTransactionMessage'
import { TransactionErrorMessage } from '../components/TransactionErrorMessage'

import shopAddress from '../contracts/CRCTShop-contract-address.json'
import shopArtifact from '../contracts/CRCTShop.json'

const HARDHAT_NETWORK_ID = '31337'
const ERROR_CODE_TX_REJECTED_BY_USER = 4001

export default class extends Component {
  constructor(props) {
    super(props)

    this.initialState = {
      selectedAccount: null,
      txBeingSent: null,
      networkError: null,
      transactionError: null,
      balance: null,
      tokenBalance: null,
      tokenPrice: null
    }

    this.state = this.initialState
  }

  _connectWallet = async () => {
    if(window.ethereum === undefined) {
      this.setState({
        networkError: 'Please install Metamask!'
      })
      return
    }

    const [selectedAddress] = await window.ethereum.request({
      method: 'eth_requestAccounts'
    })

    if(!this._checkNetwork()) { return }

    this._initialize(selectedAddress)

    window.ethereum.on('accountsChanged', ([newAddress]) => {
      if(newAddress === undefined) {
        return this._resetState()
      }

      this._initialize(newAddress)
    })

    window.ethereum.on('chainChanged', ([networkId]) => {
      this._resetState()
    })
  }

  async _initialize(selectedAddress) {
    this._provider = new ethers.providers.Web3Provider(window.ethereum)


    this._shop = new ethers.Contract(
      shopAddress.CRCTShop,
      shopArtifact.abi,
      this._provider.getSigner(0)
    )


    this.setState({
      selectedAccount: selectedAddress
    }, async () => {
      await this.updateBalance()
      await this.updateBalanceOfToken()
      await this.updatePrice()
    })
  }


  async updateBalance() {
    const newBalance = (await this._provider.getBalance(
      this.state.selectedAccount
    )).toString()

    this.setState({
      balance: newBalance
    })
  }


  async updateBalanceOfToken() {
    const newBalanceOfToken = ((await this._shop.tokenBalance(
      this.state.selectedAccount
    )) * 10 ** 18).toString()

    this.setState({
      tokenBalance: newBalanceOfToken
    })
  }


  async updatePrice() {
    const newPrice = ((await this._shop.price()) / 10**18).toString()

    this.setState({
      tokenPrice: newPrice
    })
  }

  _resetState() {
    this.setState(this.initialState)
  }

  _checkNetwork() {
    if (window.ethereum.networkVersion === HARDHAT_NETWORK_ID) { return true }

    this.setState({
      networkError: 'Please connect to localhost:8545'
    })

    return false
  }

  _dismissNetworkError = () => {
    this.setState({
      networkError: null
    })
  }

  _dismissTransactionError = () => {
    this.setState({
      transactionError: null
    })
  }


  buy = async() => {

    try {
      const tx = await this._shop.buy({
        value: ethers.utils.parseEther(this.state.tokenPrice)
      })

      this.setState({
        txBeingSent: tx.hash
      })

      await tx.wait()
    } catch(error) {
      if(error.code === ERROR_CODE_TX_REJECTED_BY_USER) { return }

      console.error(error)

      this.setState({
        transactionError: error
      })
    } finally {
      this.setState({
        txBeingSent: null
      })
      await this.updateBalance()
      await this.updateBalanceOfToken()
      await this.updatePrice()
    }
  }

  _getRpcErrorMessage(error) {
    if (error.data) {
      return error.data.message
    }

    return error.message
  }

  render() {
    if(!this.state.selectedAccount) {
      return <ConnectWallet
        connectWallet={this._connectWallet}
        networkError={this.state.networkError}
        dismiss={this._dismissNetworkError}
      />
    }

    return(
      <>
        {this.state.txBeingSent && (
          <WaitingForTransactionMessage txHash={this.state.txBeingSent} />
        )}

        {this.state.transactionError && (
          <TransactionErrorMessage
            message={this._getRpcErrorMessage(this.state.transactionError)}
            dismiss={this._dismissTransactionError}
          />
        )}


        {this.state.selectedAccount &&
          <p>Your account: {this.state.selectedAccount}</p>}

        {this.state.balance &&
          <p>Your balance: {ethers.utils.formatEther(this.state.balance)} ETH</p>}

        {this.state.tokenBalance &&
          <p>Your balance of CryptoRandomCoffeeToken: {ethers.utils.formatEther(this.state.tokenBalance)}</p>}

        {this.state.tokenPrice &&
          <div>
            <p>Current CryptoRandomCoffeeToken price: {this.state.tokenPrice} ETH</p>
            <button onClick={this.buy}>Buy!</button>
          </div>}
      </>
    )
  }
}
