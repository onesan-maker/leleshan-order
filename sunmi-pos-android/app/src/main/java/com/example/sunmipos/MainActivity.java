package com.example.sunmipos;

import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.DividerItemDecoration;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.sunmipos.model.CartItem;
import com.example.sunmipos.model.Product;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {

    // -------------------------------------------------------------------------
    // 硬寫商品資料
    // -------------------------------------------------------------------------
    private static final List<Product> MENU = new ArrayList<>();
    static {
        MENU.add(new Product(1, "珍珠奶茶",   65));
        MENU.add(new Product(2, "烏龍茶拿鐵", 75));
        MENU.add(new Product(3, "草莓奶昔",   85));
        MENU.add(new Product(4, "美式咖啡",   60));
        MENU.add(new Product(5, "焦糖瑪奇朵", 90));
        MENU.add(new Product(6, "抹茶歐蕾",   80));
    }

    // -------------------------------------------------------------------------
    // Fields
    // -------------------------------------------------------------------------
    private final List<CartItem>   cartItems   = new ArrayList<>();
    private       CartAdapter      cartAdapter;
    private       TextView         tvTotal;
    private       PrinterServiceManager printerManager;

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        setupProductList();
        setupCartList();
        setupOrderButton();
        bindPrinterService();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (printerManager != null) printerManager.unbindService();
    }

    // -------------------------------------------------------------------------
    // UI setup
    // -------------------------------------------------------------------------
    private void setupProductList() {
        RecyclerView rv = findViewById(R.id.rvProducts);
        rv.setLayoutManager(new LinearLayoutManager(this));
        rv.addItemDecoration(new DividerItemDecoration(this, DividerItemDecoration.VERTICAL));
        rv.setAdapter(new ProductAdapter(MENU, this::addToCart));
    }

    private void setupCartList() {
        tvTotal = findViewById(R.id.tvTotal);

        RecyclerView rv = findViewById(R.id.rvCart);
        rv.setLayoutManager(new LinearLayoutManager(this));
        rv.addItemDecoration(new DividerItemDecoration(this, DividerItemDecoration.VERTICAL));
        cartAdapter = new CartAdapter(cartItems);
        rv.setAdapter(cartAdapter);
    }

    private void setupOrderButton() {
        Button btn = findViewById(R.id.btnSubmitOrder);
        btn.setOnClickListener(v -> submitOrder());
    }

    // -------------------------------------------------------------------------
    // Cart logic
    // -------------------------------------------------------------------------
    private void addToCart(Product product) {
        // 若已存在則數量 +1，否則新增
        for (CartItem item : cartItems) {
            if (item.getProduct().getId() == product.getId()) {
                item.increment();
                cartAdapter.notifyDataSetChanged();
                updateTotal();
                return;
            }
        }
        cartItems.add(new CartItem(product));
        cartAdapter.notifyItemInserted(cartItems.size() - 1);
        updateTotal();
    }

    private void updateTotal() {
        int total = 0;
        for (CartItem item : cartItems) total += item.getSubtotal();
        tvTotal.setText("總計：$" + total);
    }

    private int calcTotal() {
        int total = 0;
        for (CartItem item : cartItems) total += item.getSubtotal();
        return total;
    }

    // -------------------------------------------------------------------------
    // Submit order
    // -------------------------------------------------------------------------
    private void submitOrder() {
        if (cartItems.isEmpty()) {
            Toast.makeText(this, "購物車是空的", Toast.LENGTH_SHORT).show();
            return;
        }

        int total = calcTotal();

        // 1. 列印小票
        if (printerManager != null && printerManager.isReady()) {
            // 傳副本，避免清空後列印資料消失
            printerManager.printReceipt(new ArrayList<>(cartItems), total);
            Toast.makeText(this, "訂單已送出，列印中…", Toast.LENGTH_SHORT).show();
        } else {
            Toast.makeText(this, "訂單已送出（印表機未連線）", Toast.LENGTH_SHORT).show();
        }

        // 2. 清空購物車
        cartItems.clear();
        cartAdapter.notifyDataSetChanged();
        tvTotal.setText("總計：$0");
    }

    // -------------------------------------------------------------------------
    // Printer service
    // -------------------------------------------------------------------------
    private void bindPrinterService() {
        printerManager = new PrinterServiceManager(this);
        printerManager.bindService(new PrinterServiceManager.OnBindListener() {
            @Override
            public void onBound() {
                runOnUiThread(() ->
                    Toast.makeText(MainActivity.this, "印表機已連線", Toast.LENGTH_SHORT).show()
                );
            }

            @Override
            public void onBindFailed() {
                runOnUiThread(() ->
                    Toast.makeText(MainActivity.this, "印表機連線失敗，請確認設備", Toast.LENGTH_LONG).show()
                );
            }
        });
    }
}
