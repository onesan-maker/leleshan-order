package com.leleshan.pos.ui.pos

import androidx.lifecycle.*
import com.leleshan.pos.data.model.*
import com.leleshan.pos.data.repository.MenuRepository
import com.leleshan.pos.data.repository.OrderRepository
import com.leleshan.pos.data.repository.SubmitResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed class PosUiState {
    object Idle    : PosUiState()
    object Loading : PosUiState()
    data class Success(val result: SubmitResult) : PosUiState()
    data class Error(val msg: String)            : PosUiState()
}

class PosViewModel(
    private val menuRepo : MenuRepository  = MenuRepository(),
    private val orderRepo: OrderRepository = OrderRepository()
) : ViewModel() {

    // ── 菜單 ────────────────────────────────────────────
    private val _menuItems = MutableLiveData<List<MenuItem>>()
    val menuItems: LiveData<List<MenuItem>> = _menuItems

    private val _menuError = MutableLiveData<String?>()
    val menuError: LiveData<String?> = _menuError

    // ── 購物車 ───────────────────────────────────────────
    private val _cart = MutableLiveData<List<CartItem>>(emptyList())
    val cart: LiveData<List<CartItem>> = _cart

    val cartTotal: LiveData<Int> = _cart.map { list -> list.sumOf { it.lineTotal } }
    val cartCount: LiveData<Int> = _cart.map { list -> list.sumOf { it.qty } }

    // ── 目前分份 label ───────────────────────────────────
    private var currentGroupIndex = 1   // 第 N 份
    val currentGroupLabel: String get() = "第${currentGroupIndex}份"
    val currentGroupId:    String get() = "g$currentGroupIndex"

    // ── 提交狀態 ─────────────────────────────────────────
    private val _uiState = MutableLiveData<PosUiState>(PosUiState.Idle)
    val uiState: LiveData<PosUiState> = _uiState

    // ── 今日訂單（追加用）────────────────────────────────
    private val _todayOrders = MutableLiveData<List<Order>>()
    val todayOrders: LiveData<List<Order>> = _todayOrders

    // ── 訂單明細 ─────────────────────────────────────────
    private val _orderDetail = MutableLiveData<Pair<Order, List<OrderGroup>>?>()
    val orderDetail: LiveData<Pair<Order, List<OrderGroup>>?> = _orderDetail

    private val _detailLoading = MutableLiveData(false)
    val detailLoading: LiveData<Boolean> = _detailLoading

    // ── 模式（新建 / 追加）───────────────────────────────
    var appendTargetOrderId: String? = null
        private set

    /** 追加時指定要加到哪一份（null = 新份） */
    var appendTargetGroupId: String? = null
        private set

    val isAppendMode: Boolean get() = appendTargetOrderId != null

    // ────────────────────────────────────────────────────
    // 菜單
    // ────────────────────────────────────────────────────

    fun loadMenu() {
        viewModelScope.launch {
            val result = menuRepo.loadPosMenuItems()
            result.onSuccess { _menuItems.value = it }
                  .onFailure { _menuError.value = it.message }
        }
    }

    // ────────────────────────────────────────────────────
    // 購物車操作
    // ────────────────────────────────────────────────────

    fun addToCart(
        menuItem: MenuItem,
        qty: Int            = 1,
        flavor: String      = "",
        flavorId: String    = "",
        staple: String      = "",
        stapleId: String    = "",
        stapleExtra: Int    = 0,
        selectedOptions: List<Map<String,Any>> = emptyList(),
        notes: String       = "",
        itemRole: String    = "main"
    ) {
        val newItem = CartItem(
            menuItem        = menuItem,
            qty             = qty,
            flavor          = flavor,
            flavorId        = flavorId,
            staple          = staple,
            stapleId        = stapleId,
            stapleExtraPrice= stapleExtra,
            selectedOptions = selectedOptions,
            notes           = notes,
            groupId         = currentGroupId,
            groupLabel      = currentGroupLabel,
            itemRole        = itemRole
        )
        _cart.value = (_cart.value ?: emptyList()) + newItem
    }

    fun removeFromCart(cartId: String) {
        _cart.value = (_cart.value ?: emptyList()).filter { it.cartId != cartId }
    }

    fun clearCart() {
        _cart.value = emptyList()
        currentGroupIndex = 1
    }

    /** 新增一份（分份功能） */
    fun nextGroup() {
        currentGroupIndex++
    }

    // ────────────────────────────────────────────────────
    // 提交
    // ────────────────────────────────────────────────────

    fun submitNewOrder(
        customerName: String,
        note: String,
        staffUid: String  = "pos_staff",
        staffName: String = "現場人員"
    ) {
        val items = _cart.value ?: return
        if (items.isEmpty()) { _uiState.value = PosUiState.Error("購物車是空的"); return }

        _uiState.value = PosUiState.Loading
        viewModelScope.launch {
            orderRepo.createOrder(customerName, items, note, staffUid, staffName)
                .onSuccess { _uiState.value = PosUiState.Success(it) }
                .onFailure { _uiState.value = PosUiState.Error(it.message ?: "建立訂單失敗") }
        }
    }

    fun submitAppend(
        staffUid: String  = "pos_staff",
        staffName: String = "現場人員"
    ) {
        val orderId = appendTargetOrderId ?: run {
            _uiState.value = PosUiState.Error("未選擇追加目標訂單"); return
        }
        val items = _cart.value ?: return
        if (items.isEmpty()) { _uiState.value = PosUiState.Error("購物車是空的"); return }

        _uiState.value = PosUiState.Loading
        viewModelScope.launch {
            orderRepo.appendToOrder(orderId, items, staffUid, staffName)
                .onSuccess {
                    _uiState.value = PosUiState.Success(
                        SubmitResult(orderId, "追加")
                    )
                }
                .onFailure { _uiState.value = PosUiState.Error(it.message ?: "追加失敗") }
        }
    }

    fun setAppendTarget(orderId: String?, groupId: String? = null) {
        appendTargetOrderId  = orderId
        appendTargetGroupId  = groupId
        clearCart()
        // 追加到指定份時，新品項直接用那個 group
        if (groupId != null) {
            val groups = _orderDetail.value?.second
            val group  = groups?.find { it.groupId == groupId }
            if (group != null) {
                currentGroupIndex  = groupId.removePrefix("g").toIntOrNull() ?: 1
            }
        }
    }

    /** 載入訂單明細（呼叫後結果在 orderDetail） */
    fun loadOrderDetail(order: Order) {
        _detailLoading.value = true
        viewModelScope.launch {
            orderRepo.loadOrderGroups(order.id)
                .onSuccess { groups ->
                    _orderDetail.value = order to groups
                    _detailLoading.value = false
                }
                .onFailure {
                    _menuError.value = "載入明細失敗：${it.message}"
                    _detailLoading.value = false
                }
        }
    }

    fun clearOrderDetail() { _orderDetail.value = null }

    fun loadTodayOrders() {
        viewModelScope.launch {
            orderRepo.loadTodayActiveOrders()
                .onSuccess { _todayOrders.value = it }
                .onFailure { _menuError.value = it.message }
        }
    }

    fun resetUiState() {
        _uiState.value = PosUiState.Idle
    }
}
