"use client";

import { useState } from "react";

export interface LineItem {
  id: string;
  description: string;
  amount: number;
  quantity: number;
  billing_type: "monthly" | "one-time";
}

interface LineItemsEditorProps {
  value: string; // JSON string of LineItem[]
  onChange: (json: string) => void;
}

function parseItems(value: string): LineItem[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function LineItemsEditor({ value, onChange }: LineItemsEditorProps) {
  const [items, setItems] = useState<LineItem[]>(() => parseItems(value));

  function emit(updated: LineItem[]) {
    setItems(updated);
    onChange(JSON.stringify(updated));
  }

  function addItem(billingType: "monthly" | "one-time") {
    emit([...items, { id: crypto.randomUUID(), description: "", amount: 0, quantity: 1, billing_type: billingType }]);
  }

  function updateItem(id: string, field: keyof LineItem, val: string | number) {
    emit(items.map((it) => (it.id === id ? { ...it, [field]: val } : it)));
  }

  function removeItem(id: string) {
    emit(items.filter((it) => it.id !== id));
  }

  const monthly = items.filter((i) => i.billing_type === "monthly");
  const oneTime = items.filter((i) => i.billing_type === "one-time");
  const monthlyTotal = monthly.reduce((s, i) => s + i.amount * i.quantity, 0);
  const oneTimeTotal = oneTime.reduce((s, i) => s + i.amount * i.quantity, 0);

  const cls = "bg-pm-bg border border-pm-border rounded-lg px-3 py-1.5 text-pm-text text-sm focus:outline-none focus:border-blue-500";

  return (
    <div className="space-y-6">
      {/* Monthly Recurring */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-blue-400">Monthly Recurring</h4>
          <button
            type="button"
            onClick={() => addItem("monthly")}
            className="text-xs px-2 py-1 bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30"
          >
            + Add Monthly Item
          </button>
        </div>
        {monthly.length === 0 ? (
          <p className="text-xs text-pm-muted italic">No monthly recurring items</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_100px_60px_32px] gap-2 text-xs font-medium text-pm-muted px-1">
              <span>Description</span>
              <span>Amount</span>
              <span>Qty</span>
              <span></span>
            </div>
            {monthly.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_100px_60px_32px] gap-2 items-center">
                <input
                  className={cls}
                  value={item.description}
                  onChange={(e) => updateItem(item.id, "description", e.target.value)}
                  placeholder="Service or product name"
                />
                <div className="relative">
                  <span className="absolute left-2 top-2 text-pm-muted text-sm">$</span>
                  <input
                    type="number"
                    className={`${cls} pl-6 w-full`}
                    value={item.amount || ""}
                    onChange={(e) => updateItem(item.id, "amount", parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
                <input
                  type="number"
                  className={`${cls} w-full`}
                  value={item.quantity}
                  min={1}
                  onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                />
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-red-400 hover:text-red-300 text-sm p-1"
                  title="Remove"
                >
                  &times;
                </button>
              </div>
            ))}
            <div className="flex justify-end text-sm font-semibold text-blue-400 pr-10 pt-1">
              Monthly Total: ${monthlyTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
        )}
      </div>

      {/* One-Time Costs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-emerald-400">One-Time Costs</h4>
          <button
            type="button"
            onClick={() => addItem("one-time")}
            className="text-xs px-2 py-1 bg-emerald-600/20 text-emerald-400 rounded hover:bg-emerald-600/30"
          >
            + Add One-Time Item
          </button>
        </div>
        {oneTime.length === 0 ? (
          <p className="text-xs text-pm-muted italic">No one-time cost items</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_100px_60px_32px] gap-2 text-xs font-medium text-pm-muted px-1">
              <span>Description</span>
              <span>Amount</span>
              <span>Qty</span>
              <span></span>
            </div>
            {oneTime.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_100px_60px_32px] gap-2 items-center">
                <input
                  className={cls}
                  value={item.description}
                  onChange={(e) => updateItem(item.id, "description", e.target.value)}
                  placeholder="Service or product name"
                />
                <div className="relative">
                  <span className="absolute left-2 top-2 text-pm-muted text-sm">$</span>
                  <input
                    type="number"
                    className={`${cls} pl-6 w-full`}
                    value={item.amount || ""}
                    onChange={(e) => updateItem(item.id, "amount", parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
                <input
                  type="number"
                  className={`${cls} w-full`}
                  value={item.quantity}
                  min={1}
                  onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                />
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-red-400 hover:text-red-300 text-sm p-1"
                  title="Remove"
                >
                  &times;
                </button>
              </div>
            ))}
            <div className="flex justify-end text-sm font-semibold text-emerald-400 pr-10 pt-1">
              One-Time Total: ${oneTimeTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
        )}
      </div>

      {/* Grand total */}
      {(monthly.length > 0 || oneTime.length > 0) && (
        <div className="border-t border-pm-border pt-3 text-sm text-pm-muted">
          {monthly.length > 0 && oneTime.length > 0 && (
            <p>
              <strong className="text-pm-text">Combined:</strong>{" "}
              ${monthlyTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}/mo recurring
              {" + "}
              ${oneTimeTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} one-time
            </p>
          )}
        </div>
      )}
    </div>
  );
}
