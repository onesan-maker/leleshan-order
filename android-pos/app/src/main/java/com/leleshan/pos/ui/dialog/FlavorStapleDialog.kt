package com.leleshan.pos.ui.dialog

import android.os.Bundle
import android.view.*
import android.widget.*
import androidx.core.os.bundleOf
import androidx.fragment.app.DialogFragment
import androidx.fragment.app.setFragmentResult
import com.leleshan.pos.R
import com.leleshan.pos.data.model.Flavor
import com.leleshan.pos.data.model.MenuItem
import com.leleshan.pos.data.model.StapleOption

/**
 * 選擇口味 + 主食 Dialog。
 *
 * 優化重點：
 * 1. 非套餐品項：顯示「快速加入」按鈕（用第一個口味直接送出，0 個額外點擊）
 * 2. 套餐：主食預選第一個（免費）
 * 3. 口味按鈕改用 ToggleButton 網格，觸控面積更大
 * 4. 數量用 +/- 大按鈕，文字大
 */
class FlavorStapleDialog : DialogFragment() {

    companion object {
        const val REQUEST_KEY   = "flavor_staple_result"
        const val KEY_FLAVOR    = "flavor"
        const val KEY_FLAVOR_ID = "flavorId"
        const val KEY_STAPLE    = "staple"
        const val KEY_STAPLE_ID = "stapleId"
        const val KEY_STAPLE_EXTRA = "stapleExtra"
        const val KEY_NOTES     = "notes"
        const val KEY_QTY       = "qty"

        fun newInstance(menuItem: MenuItem, groupLabel: String): FlavorStapleDialog =
            FlavorStapleDialog().apply {
                arguments = bundleOf(
                    "itemId"     to menuItem.id,
                    "itemName"   to menuItem.name,
                    "isCombo"    to menuItem.isCombo,
                    "groupLabel" to groupLabel
                )
            }
    }

    private var selectedFlavorId    = Flavor.defaults.first().id
    private var selectedFlavor      = Flavor.defaults.first().name
    private var selectedStapleId    = StapleOption.defaults.first().id
    private var selectedStaple      = StapleOption.defaults.first().name
    private var selectedStapleExtra = StapleOption.defaults.first().price
    private var qty = 1

    override fun onStart() {
        super.onStart()
        // Dialog 寬度 85%，觸控操作更舒適
        dialog?.window?.setLayout(
            (resources.displayMetrics.widthPixels * 0.85).toInt(),
            WindowManager.LayoutParams.WRAP_CONTENT
        )
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.dialog_flavor_staple, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val isCombo    = arguments?.getBoolean("isCombo") ?: false
        val itemName   = arguments?.getString("itemName") ?: ""
        val groupLabel = arguments?.getString("groupLabel") ?: "第1份"

        view.findViewById<TextView>(R.id.tvDialogTitle).text = "【$groupLabel】$itemName"

        setupFlavorButtons(view)
        setupStapleSection(view, isCombo)
        setupQty(view)
        setupButtons(view, isCombo)
    }

    // ── 口味：大按鈕網格 ─────────────────────────────────

    private fun setupFlavorButtons(view: View) {
        val container = view.findViewById<LinearLayout>(R.id.llFlavorButtons)
        container.removeAllViews()

        // 每行放 2 個，用 horizontal LinearLayout
        var row: LinearLayout? = null
        Flavor.defaults.forEachIndexed { idx, f ->
            if (idx % 2 == 0) {
                row = LinearLayout(requireContext()).apply {
                    orientation = LinearLayout.HORIZONTAL
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).also { it.bottomMargin = 8 }
                }
                container.addView(row)
            }
            val btn = Button(requireContext()).apply {
                text     = f.name
                textSize = 16f
                tag      = f.id
                layoutParams = LinearLayout.LayoutParams(0,
                    dpToPx(52), 1f).also { it.marginEnd = if (idx % 2 == 0) 6 else 0 }
                isAllCaps = false
                updateFlavorButton(this, f.id == selectedFlavorId)
                setOnClickListener {
                    selectedFlavorId = f.id
                    selectedFlavor   = f.name
                    // 刷新所有按鈕狀態
                    refreshFlavorButtons(container)
                }
            }
            row?.addView(btn)
        }
        // 奇數個時補空白
        if (Flavor.defaults.size % 2 != 0) {
            row?.addView(View(requireContext()).apply {
                layoutParams = LinearLayout.LayoutParams(0, dpToPx(52), 1f)
            })
        }
    }

    private fun refreshFlavorButtons(container: LinearLayout) {
        for (i in 0 until container.childCount) {
            val row = container.getChildAt(i) as? LinearLayout ?: continue
            for (j in 0 until row.childCount) {
                val btn = row.getChildAt(j) as? Button ?: continue
                updateFlavorButton(btn, btn.tag as? String == selectedFlavorId)
            }
        }
    }

    private fun updateFlavorButton(btn: Button, selected: Boolean) {
        btn.setBackgroundColor(
            requireContext().getColor(
                if (selected) android.R.color.holo_blue_dark
                else android.R.color.darker_gray
            )
        )
        btn.setTextColor(requireContext().getColor(android.R.color.white))
    }

    // ── 主食：RadioGroup（套餐才顯示） ───────────────────

    private fun setupStapleSection(view: View, isCombo: Boolean) {
        val section = view.findViewById<LinearLayout>(R.id.llStapleSection)
        section.visibility = if (isCombo) View.VISIBLE else View.GONE
        if (!isCombo) return

        val rg = view.findViewById<RadioGroup>(R.id.rgStaple)
        StapleOption.defaults.forEach { s ->
            RadioButton(requireContext()).apply {
                id       = View.generateViewId()
                text     = if (s.price > 0) "${s.name}（+NT\$${s.price}）" else s.name
                textSize = 18f
                tag      = s.id
                setPadding(16, 14, 16, 14)
                rg.addView(this)
            }
        }
        rg.setOnCheckedChangeListener { group, checkedId ->
            val btn = group.findViewById<RadioButton>(checkedId)
            val sid = btn?.tag as? String ?: return@setOnCheckedChangeListener
            selectedStapleId    = sid
            val opt             = StapleOption.defaults.find { it.id == sid }
            selectedStaple      = opt?.name ?: ""
            selectedStapleExtra = opt?.price ?: 0
        }
        // 預選第一個（白飯，免費）
        (rg.getChildAt(0) as? RadioButton)?.isChecked = true
    }

    // ── 數量 ─────────────────────────────────────────────

    private fun setupQty(view: View) {
        val tvQty    = view.findViewById<TextView>(R.id.tvQty)
        val btnMinus = view.findViewById<Button>(R.id.btnQtyMinus)
        val btnPlus  = view.findViewById<Button>(R.id.btnQtyPlus)
        tvQty.text = "1"
        btnMinus.setOnClickListener {
            if (qty > 1) { qty--; tvQty.text = qty.toString() }
        }
        btnPlus.setOnClickListener {
            qty++; tvQty.text = qty.toString()
        }
    }

    // ── 按鈕 ─────────────────────────────────────────────

    private fun setupButtons(view: View, isCombo: Boolean) {
        val etNotes      = view.findViewById<EditText>(R.id.etItemNotes)
        val btnQuickAdd  = view.findViewById<Button>(R.id.btnQuickAdd)
        val btnConfirm   = view.findViewById<Button>(R.id.btnConfirm)
        val btnCancel    = view.findViewById<Button>(R.id.btnCancel)

        // 非套餐才顯示「快速加入」（直接用預設口味，不需填主食）
        btnQuickAdd.visibility = if (isCombo) View.GONE else View.VISIBLE

        btnQuickAdd.setOnClickListener {
            sendResult(etNotes.text.toString().trim())
        }
        btnConfirm.setOnClickListener {
            sendResult(etNotes.text.toString().trim())
        }
        btnCancel.setOnClickListener { dismiss() }
    }

    private fun sendResult(notes: String) {
        setFragmentResult(REQUEST_KEY, bundleOf(
            KEY_FLAVOR       to selectedFlavor,
            KEY_FLAVOR_ID    to selectedFlavorId,
            KEY_STAPLE       to selectedStaple,
            KEY_STAPLE_ID    to selectedStapleId,
            KEY_STAPLE_EXTRA to selectedStapleExtra,
            KEY_NOTES        to notes,
            KEY_QTY          to qty
        ))
        dismiss()
    }

    private fun dpToPx(dp: Int): Int =
        (dp * resources.displayMetrics.density).toInt()
}
