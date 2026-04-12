package com.leleshan.pos.ui.pos

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.leleshan.pos.R
import com.leleshan.pos.data.model.CartItem

class CartAdapter(
    private val onRemove: (String) -> Unit
) : ListAdapter<CartItem, CartAdapter.VH>(DIFF) {

    override fun onCreateViewHolder(parent: ViewGroup, vt: Int): VH {
        val v = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_cart, parent, false)
        return VH(v)
    }

    override fun onBindViewHolder(h: VH, pos: Int) {
        val item = getItem(pos)

        val nameLabel = buildString {
            if (getItemCount() > 0) {
                // 在同 group 第一個才顯示 groupLabel
                val prevGroup = if (pos > 0) getItem(pos - 1).groupId else ""
                if (item.groupId != prevGroup) {
                    // 如果有多份才顯示
                    val allGroups = (0 until itemCount).map { getItem(it).groupId }.distinct()
                    if (allGroups.size > 1) append("[${item.groupLabel}] ")
                }
            }
            append(item.menuItem.name)
            if (item.menuItem.isCombo) append(" 套餐")
        }
        h.tvName.text     = nameLabel
        h.tvQty.text      = "x${item.qty}"
        h.tvSubtotal.text = "NT\$${item.lineTotal}"

        // 次要資訊（主食 / 口味）
        val sub = buildList<String> {
            if (item.flavor.isNotBlank()) add("口味：${item.flavor}")
            if (item.staple.isNotBlank()) add("主食：${item.staple}")
            if (item.notes.isNotBlank())  add("備：${item.notes}")
        }.joinToString("  ")
        h.tvSub.text      = sub
        h.tvSub.visibility= if (sub.isBlank()) View.GONE else View.VISIBLE

        h.btnRemove.setOnClickListener { onRemove(item.cartId) }
    }

    class VH(v: View) : RecyclerView.ViewHolder(v) {
        val tvName:    TextView    = v.findViewById(R.id.tvCartName)
        val tvQty:     TextView    = v.findViewById(R.id.tvCartQty)
        val tvSubtotal:TextView    = v.findViewById(R.id.tvCartSubtotal)
        val tvSub:     TextView    = v.findViewById(R.id.tvCartSub)
        val btnRemove: ImageButton = v.findViewById(R.id.btnRemoveCart)
    }

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<CartItem>() {
            override fun areItemsTheSame(a: CartItem, b: CartItem) = a.cartId == b.cartId
            override fun areContentsTheSame(a: CartItem, b: CartItem) = a == b
        }
    }
}
