package com.example.sunmipos;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.sunmipos.model.CartItem;

import java.util.List;

public class CartAdapter extends RecyclerView.Adapter<CartAdapter.VH> {

    private final List<CartItem> items;

    public CartAdapter(List<CartItem> items) {
        this.items = items;
    }

    @NonNull
    @Override
    public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View v = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_cart, parent, false);
        return new VH(v);
    }

    @Override
    public void onBindViewHolder(@NonNull VH h, int position) {
        CartItem item = items.get(position);
        h.tvName.setText(item.getProduct().getName());
        h.tvQty.setText("x" + item.getQuantity());
        h.tvSubtotal.setText("$" + item.getSubtotal());
    }

    @Override
    public int getItemCount() { return items.size(); }

    static class VH extends RecyclerView.ViewHolder {
        TextView tvName, tvQty, tvSubtotal;
        VH(View v) {
            super(v);
            tvName     = v.findViewById(R.id.tvCartName);
            tvQty      = v.findViewById(R.id.tvCartQty);
            tvSubtotal = v.findViewById(R.id.tvCartSubtotal);
        }
    }
}
