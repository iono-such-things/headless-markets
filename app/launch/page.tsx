'use client'

import { useState } from 'react'

// Scaffolding template - expand with full market creation flow
// TODO: Add form validation
// TODO: Add market parameter configuration (oracle, resolution rules)
// TODO: Add liquidity setup interface
// TODO: Connect to smart contract for market deployment
// TODO: Add fee calculation preview
// TODO: Add market template selection

export default function LaunchPage() {
  const [formData, setFormData] = useState({
    question: '',
    description: '',
    category: '',
    closingDate: '',
    initialLiquidity: '',
  })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Market</h1>
        <p className="text-gray-600 mt-2">
          Launch a new prediction market
        </p>
      </div>

      <form className="space-y-6 bg-white p-8 rounded-lg shadow">
        {/* Market Question */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Market Question *
          </label>
          <input
            type="text"
            className="w-full px-4 py-2 border rounded-lg"
            placeholder="Will X happen by Y date?"
            value={formData.question}
            onChange={(e) => setFormData({ ...formData, question: e.target.value })}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Description *
          </label>
          <textarea
            className="w-full px-4 py-2 border rounded-lg"
            rows={4}
            placeholder="Provide context and resolution criteria..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Category *
          </label>
          <select
            className="w-full px-4 py-2 border rounded-lg"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          >
            <option value="">Select category</option>
            <option value="crypto">Crypto</option>
            <option value="sports">Sports</option>
            <option value="politics">Politics</option>
            <option value="business">Business</option>
          </select>
        </div>

        {/* Closing Date */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Closing Date *
          </label>
          <input
            type="datetime-local"
            className="w-full px-4 py-2 border rounded-lg"
            value={formData.closingDate}
            onChange={(e) => setFormData({ ...formData, closingDate: e.target.value })}
          />
        </div>

        {/* Initial Liquidity */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Initial Liquidity (USDC)
          </label>
          <input
            type="number"
            className="w-full px-4 py-2 border rounded-lg"
            placeholder="1000"
            value={formData.initialLiquidity}
            onChange={(e) => setFormData({ ...formData, initialLiquidity: e.target.value })}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Create Market
        </button>
      </form>
    </div>
  )
}
