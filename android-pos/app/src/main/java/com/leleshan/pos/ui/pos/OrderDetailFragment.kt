package com.leleshan.pos.ui.pos

import android.os.Bundle
import android.view.*
import android.widget.*
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.leleshan.pos.R
import com.leleshan.pos.data.model.Order
import com.leleshan.pos.data.model.OrderGroup
import com.leleshan.pos.data.model.OrderItemDoc
import com.leleshan.pos.util.toast

/**
 * 訂單明細畫面。
 * 顯示訂單基本資訊 + 依 groupId 分份展示品項。
 * 每一份提供「追加到此份」按鈕。
 */
class OrderDetailFragment : Fragment() {

    private val vm: PosViewModel by activityViewModels()
    private lateinit var groupAdapter: OrderGroupAdapter

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.fragment_order_detail, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        setupGroupList(view)
        observeViewModel(view)

        view.findViewById<ImageButton>(R.id.btnBack).setOnClickListener {
            parentFragmentManager.popBackStack()
        }

        // 追加新份（不指定 groupId）
        view.findViewById<Button>(R.id.btnAppendNewGroup).setOnClickListener {
            val orderId = vm.orderDetail.value?.first?.id ?: return@setOnClickListener
            vm.setAppendTarget(orderId, null)
            vm.nextGroup()
            parentFragmentManager.popBackStack()
            toast("追加模式：${vm.currentGroupLabel}（新份）")
        }
    }

    private fun setupGroupList(view: View) {
        groupAdapter = OrderGroupAdapter(
            onAppendToGroup = { group ->
                val orderId = vm.orderDetail.value?.first?.id ?: return@OrderGroupAdapter
                vm.setAppendTarget(orderId, group.groupId)
                parentFragmentManager.popBackStack()
                toast("追加模式：追加到 ${group.groupLabel}")
            }
        )
        view.findViewById<RecyclerView>(R.id.rvGroups).apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = groupAdapter
        }
    }

    private fun observeViewModel(view: View) {
        vm.detailLoading.observe(viewLifecycleOwner) { loading ->
            view.findViewById<ProgressBar>(R.id.progressDetail).visibility =
                if (loading) View.VISIBLE else View.GONE
        }

        vm.orderDetail.observe(viewLifecycleOwner) { pair ->
            if (pair == null) return@observe
            val (order, groups) = pair
            bindOrderHeader(view, order)
            groupAdapter.submitList(groups)
        }
    }

    private fun bindOrderHeader(view: View, order: Order) {
        view.findViewById<TextView>(R.id.tvDetailPickupNumber).text =
            "#${order.pickupNumber}"
        view.findViewById<TextView>(R.id.tvDetailCustomer).text =
            order.customerName.ifBlank { "（未填）" }
        view.findViewById<TextView>(R.id.tvDetailStatus).text = order.status
        view.findViewById<TextView>(R.id.tvDetailTotal).text =
            "NT\$${order.total}"
        view.findViewById<TextView>(R.id.tvDetailNote).apply {
            text = order.note.ifBlank { "（無備註）" }
            visibility = View.VISIBLE
        }
    }
}

// ─────────────────────────────────────────────────────────
// OrderGroupAdapter：顯示一份（第N份）的全部品項
// ─────────────────────────────────────────────────────────
class OrderGroupAdapter(
    private val onAppendToGroup: (OrderGroup) -> Unit
) : RecyclerView.Adapter<OrderGroupAdapter.VH>() {

    private var groups: List<OrderGroup> = emptyList()

    fun submitList(list: List<OrderGroup>) {
        groups = list
        notifyDataSetChanged()
    }

    override fun getItemCount() = groups.size

    override fun onCreateViewHolder(parent: ViewGroup, vt: Int): VH {
        val v = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_order_group, parent, false)
        return VH(v)
    }

    override fun onBindViewHolder(h: VH, pos: Int) {
        val group = groups[pos]
        h.tvGroupLabel.text    = group.groupLabel
        h.tvGroupSubtotal.text = "小計 NT\$${group.subtotal}"

        // 品項列表（純文字，不用 RecyclerView 嵌套）
        h.llItems.removeAllViews()
        for (item in group.items) {
            val tv = TextView(h.itemView.context).apply {
                text = buildItemText(item)
                textSize = 15f
                setPadding(0, 6, 0, 6)
            }
            h.llItems.addView(tv)
        }

        h.btnAppendToGroup.setOnClickListener { onAppendToGroup(group) }
    }

    private fun buildItemText(item: OrderItemDoc): String = buildString {
        val role = if (item.itemRole == "addon") "  ↳ " else ""
        append("$role${item.displayName} x${item.qty}")
        append("  NT\$${item.lineTotal}")
        if (item.flavor.isNotBlank()) append("\n      口味：${item.flavor}")
        if (item.staple.isNotBlank()) append("\n      主食：${item.staple}")
        for (opt in item.selectedOptions) {
            val v = opt["value"] as? String ?: continue
            val n = opt["name"]  as? String ?: ""
            append("\n      $n：$v")
        }
        if (item.notes.isNotBlank()) append("\n      備：${item.notes}")
    }

    class VH(v: View) : RecyclerView.ViewHolder(v) {
        val tvGroupLabel:    TextView    = v.findViewById(R.id.tvGroupLabel)
        val tvGroupSubtotal: TextView    = v.findViewById(R.id.tvGroupSubtotal)
        val llItems:         LinearLayout= v.findViewById(R.id.llGroupItems)
        val btnAppendToGroup:Button      = v.findViewById(R.id.btnAppendToGroup)
    }
}
