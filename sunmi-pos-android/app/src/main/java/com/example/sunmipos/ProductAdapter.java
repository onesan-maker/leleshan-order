package com.example.sunmipos;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.sunmipos.model.Product;

import java.util.List;

public class ProductAdapter extends RecyclerView.Adapter<ProductAdapter.VH> {

    public interface OnAddToCartListener {
        void onAdd(Product product);
    }

    private final List<Product>       products;
    private final OnAddToCartListener listener;

    public ProductAdapter(List<Product> products, OnAddToCartListener listener) {
        this.products = products;
        this.listener = listener;
    }

    @NonNull
    @Override
    public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View v = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_product, parent, false);
        return new VH(v);
    }

    @Override
    public void onBindViewHolder(@NonNull VH h, int position) {
        Product p = products.get(position);
        h.tvName.setText(p.getName());
        h.tvPrice.setText("$" + p.getPrice());
        h.btnAdd.setOnClickListener(v -> listener.onAdd(p));
    }

    @Override
    public int getItemCount() { return products.size(); }

    static class VH extends RecyclerView.ViewHolder {
        TextView tvName, tvPrice;
        Button   btnAdd;
        VH(View v) {
            super(v);
            tvName  = v.findViewById(R.id.tvProductName);
            tvPrice = v.findViewById(R.id.tvProductPrice);
            btnAdd  = v.findViewById(R.id.btnAddToCart);
        }
    }
}
