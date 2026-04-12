package com.leleshan.pos.ui.pos

import android.os.Bundle
import android.view.*
import android.widget.*
import androidx.core.os.bundleOf
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.fragment.app.setFragmentResultListener
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.leleshan.pos.AppConfig
import com.leleshan.pos.R
import com.leleshan.pos.data.model.MenuItem
import com.leleshan.pos.printer.PrinterContract
import com.leleshan.pos.ui.dialog.FlavorStapleDialog
import com.leleshan.pos.util.toast

/**
 * 主 POS 畫面。
 * 左側：菜單（GridLayout，2 欄）
 * 右側：購物車 + 顧客名稱 + 送出
 */
class PosFragment : Fragment() {

    private val vm: PosViewModel by activityViewModels()
    private lateinit var printer: PrinterContract

    private lateinit var menuAdapter:  MenuAdapter
    private lateinit var cartAdapter:  CartAdapter

    // 暫存待加入購物車的品項，等 dialog 回來
    private var pendingMenuItem: MenuItem? = null

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.fragment_pos, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        printer = (requireActivity() as MainActivity).printer

        setupMenuList(view)
        setupCartList(view)
        setupButtons(view)
        observeViewModel(view)

        // 監聽 FlavorStapleDialog 的回傳
        setFragmentResultListener(FlavorStapleDialog.REQUEST_KEY) { _, bundle ->
            val item = pendingMenuItem ?: return@setFragmentResultListener
            pendingMenuItem = null
            vm.addToCart(
                menuItem        = item,
                qty             = bundle.getInt(FlavorStapleDialog.KEY_QTY, 1),
                flavor          = bundle.getString(FlavorStapleDialog.KEY_FLAVOR, ""),
                flavorId        = bundle.getString(FlavorStapleDialog.KEY_FLAVOR_ID, ""),
                staple          = bundle.getString(FlavorStapleDialog.KEY_STAPLE, ""),
                stapleId        = bundle.getString(FlavorStapleDialog.KEY_STAPLE_ID, ""),
                stapleExtra     = bundle.getInt(FlavorStapleDialog.KEY_STAPLE_EXTRA, 0),
                notes           = bundle.getString(FlavorStapleDialog.KEY_NOTES, "")
            )
        }

        vm.loadMenu()
    }

    // ── 左側菜單 ──────────────────────────────────────────

    private fun setupMenuList(view: View) {
        menuAdapter = MenuAdapter { item ->
            pendingMenuItem = item
            FlavorStapleDialog.newInstance(item, vm.currentGroupLabel)
                .show(childFragmentManager, "flavor_staple")
        }
        view.findViewById<RecyclerView>(R.id.rvMenu).apply {
            layoutManager = GridLayoutManager(requireContext(), 2)
            adapter = menuAdapter
        }
    }

    // ── 右側購物車 ────────────────────────────────────────

    private fun setupCartList(view: View) {
        cartAdapter = CartAdapter { cartId -> vm.removeFromCart(cartId) }
        view.findViewById<RecyclerView>(R.id.rvCart).apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = cartAdapter
        }
    }

    // ── 按鈕 ──────────────────────────────────────────────

    private fun setupButtons(view: View) {
        // 送出訂單
        view.findViewById<Button>(R.id.btnSubmit).setOnClickListener {
            val name = view.findViewById<EditText>(R.id.etCustomerName).text.toString().trim()
            val note = view.findViewById<EditText>(R.id.etOrderNote).text.toString().trim()
            if (vm.isAppendMode) {
                vm.submitAppend()
            } else {
                if (name.isBlank()) { toast("請輸入顧客稱呼"); return@setOnClickListener }
                vm.submitNewOrder(name, note)
            }
        }

        // 清空購物車
        view.findViewById<Button>(R.id.btnClearCart).setOnClickListener {
            vm.clearCart()
            vm.setAppendTarget(null)
            updateModeLabel(view)
        }

        // 新增一份（分份）
        view.findViewById<Button>(R.id.btnNextGroup).setOnClickListener {
            vm.nextGroup()
            toast("切換至 ${vm.currentGroupLabel}")
        }

        // 追加訂單 — 開啟今日訂單列表
        view.findViewById<Button>(R.id.btnAppendMode).setOnClickListener {
            vm.loadTodayOrders()
            showTodayOrdersSheet(view)
        }
    }

    // ── 觀察 ViewModel ────────────────────────────────────

    private fun observeViewModel(view: View) {
        vm.menuItems.observe(viewLifecycleOwner) {
            menuAdapter.submitList(it)
        }
        vm.menuError.observe(viewLifecycleOwner) {
            if (it != null) toast("菜單載入失敗：$it")
        }
        vm.cart.observe(viewLifecycleOwner) {
            cartAdapter.submitList(it)
        }
        vm.cartTotal.observe(viewLifecycleOwner) { total ->
            view.findViewById<TextView>(R.id.tvTotal).text = "NT\$$total"
        }
        vm.cartCount.observe(viewLifecycleOwner) { count ->
            view.findViewById<Button>(R.id.btnSubmit).text =
                if (vm.isAppendMode) "追加訂單（$count 項）"
                else "送出訂單（$count 項）"
        }
        vm.uiState.observe(viewLifecycleOwner) { state ->
            val btnSubmit = view.findViewById<Button>(R.id.btnSubmit)
            when (state) {
                is PosUiState.Loading -> {
                    btnSubmit.isEnabled = false
                    btnSubmit.text = "送出中…"
                }
                is PosUiState.Success -> {
                    val isAppend = state.result.pickupNumber == "追加"
                    val msg = if (isAppend) "追加成功！" else "建立成功！#${state.result.pickupNumber}"
                    toast(msg)

                    // 列印：拍下 cart 快照再清空，避免 race condition
                    val items = vm.cart.value?.toList() ?: emptyList()
                    val total = vm.cartTotal.value ?: 0
                    val name  = view.findViewById<EditText>(R.id.etCustomerName).text.toString()
                    val note  = view.findViewById<EditText>(R.id.etOrderNote).text.toString()

                    vm.clearCart()
                    view.findViewById<EditText>(R.id.etCustomerName).text?.clear()
                    view.findViewById<EditText>(R.id.etOrderNote).text?.clear()
                    vm.setAppendTarget(null)
                    updateModeLabel(view)
                    vm.resetUiState()
                    btnSubmit.isEnabled = true
                    btnSubmit.text = "送出訂單（0 項）"

                    // 列印（非同步，UI 已恢復）
                    printer.printOrder(
                        pickupNumber = state.result.pickupNumber,
                        customerName = name,
                        note         = note,
                        items        = items,
                        total        = total
                    ) { success, printMsg ->
                        requireActivity().runOnUiThread {
                            toast(if (success) "列印完成" else "⚠ 列印失敗：$printMsg")
                        }
                    }
                }
                is PosUiState.Error -> {
                    toast("⚠ ${state.msg}")
                    btnSubmit.isEnabled = true
                    updateModeLabel(view)   // 重新顯示正確按鈕文字
                    vm.resetUiState()
                }
                else -> {
                    btnSubmit.isEnabled = true
                }
            }
        }
    }

    // ── 今日訂單 Bottom Sheet（追加 / 查看明細）──────────

    private fun showTodayOrdersSheet(view: View) {
        val sheet    = view.findViewById<LinearLayout>(R.id.llOrderSheet)
        val rvOrders = view.findViewById<RecyclerView>(R.id.rvTodayOrders)

        val adapter = TodayOrderAdapter(
            onAppend = { order ->
                vm.setAppendTarget(order.id, null)
                updateModeLabel(view)
                sheet.visibility = View.GONE
                toast("追加模式：${order.displayLabel}")
            },
            onDetail = { order ->
                sheet.visibility = View.GONE
                vm.loadOrderDetail(order)
                // 導航到訂單明細頁
                parentFragmentManager.beginTransaction()
                    .replace(R.id.fragmentContainer, OrderDetailFragment())
                    .addToBackStack("order_detail")
                    .commit()
            }
        )

        rvOrders.layoutManager = LinearLayoutManager(requireContext())
        rvOrders.adapter = adapter
        vm.todayOrders.observe(viewLifecycleOwner) { adapter.submitList(it) }
        sheet.visibility = View.VISIBLE
        view.findViewById<Button>(R.id.btnCloseSheet).setOnClickListener {
            sheet.visibility = View.GONE
        }
    }

    private fun updateModeLabel(view: View) {
        val tv = view.findViewById<TextView>(R.id.tvModeLabel)
        tv.text = if (vm.isAppendMode) "追加模式" else "新訂單"
        tv.setBackgroundColor(
            if (vm.isAppendMode)
                requireContext().getColor(android.R.color.holo_orange_dark)
            else
                requireContext().getColor(R.color.colorPrimary)
        )
    }
}
