package com.leleshan.pos.ui.pos

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.leleshan.pos.R
import com.leleshan.pos.data.model.Order

class TodayOrderAdapter(
    private val onAppend: (Order) -> Unit,
    private val onDetail: ((Order) -> Unit)? = null
) : ListAdapter<Order, TodayOrderAdapter.VH>(DIFF) {

    override fun onCreateViewHolder(parent: ViewGroup, vt: Int): VH {
        val v = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_today_order, parent, false)
        return VH(v)
    }

    override fun onBindViewHolder(h: VH, pos: Int) {
        val order = getItem(pos)
        h.tvNumber.text  = "#${order.pickupNumber}"
        h.tvName.text    = order.customerName
        h.tvStatus.text  = order.status
        h.tvTotal.text   = "NT\$${order.total}"
        h.btnAppend.isEnabled = order.canAppend
        h.btnAppend.setOnClickListener { onAppend(order) }
        // 點整列 → 查看明細
        h.itemView.setOnClickListener { onDetail?.invoke(order) }
    }

    class VH(v: View) : RecyclerView.ViewHolder(v) {
        val tvNumber:  TextView = v.findViewById(R.id.tvOrderNumber)
        val tvName:    TextView = v.findViewById(R.id.tvOrderCustomer)
        val tvStatus:  TextView = v.findViewById(R.id.tvOrderStatus)
        val tvTotal:   TextView = v.findViewById(R.id.tvOrderTotal)
        val btnAppend: TextView = v.findViewById(R.id.btnAppendOrder)
    }

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<Order>() {
            override fun areItemsTheSame(a: Order, b: Order) = a.id == b.id
            override fun areContentsTheSame(a: Order, b: Order) = a == b
        }
    }
}
