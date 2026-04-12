package com.leleshan.pos.ui.pos

import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.leleshan.pos.R
import com.leleshan.pos.data.model.MenuItem

class MenuAdapter(
    private val onItemClick: (MenuItem) -> Unit
) : ListAdapter<MenuItem, MenuAdapter.VH>(DIFF) {

    override fun onCreateViewHolder(parent: ViewGroup, vt: Int): VH {
        val v = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_menu, parent, false)
        return VH(v)
    }

    override fun onBindViewHolder(h: VH, pos: Int) {
        val item = getItem(pos)
        h.tvName.text  = if (item.isCombo) "${item.name} 套餐" else item.name
        h.tvPrice.text = "NT\$${item.price}"
        h.tvSoldOut.visibility = if (item.isSoldOut) View.VISIBLE else View.GONE
        h.itemView.alpha = if (item.isSoldOut) 0.4f else 1.0f
        h.itemView.setOnClickListener { if (!item.isSoldOut) onItemClick(item) }
    }

    class VH(v: View) : RecyclerView.ViewHolder(v) {
        val tvName:   TextView = v.findViewById(R.id.tvMenuName)
        val tvPrice:  TextView = v.findViewById(R.id.tvMenuPrice)
        val tvSoldOut:TextView = v.findViewById(R.id.tvSoldOut)
    }

    companion object {
        val DIFF = object : DiffUtil.ItemCallback<MenuItem>() {
            override fun areItemsTheSame(a: MenuItem, b: MenuItem) = a.id == b.id
            override fun areContentsTheSame(a: MenuItem, b: MenuItem) = a == b
        }
    }
}
