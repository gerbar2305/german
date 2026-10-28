import React, { useEffect, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

const initialForm = {
  sku: "",
  name: "",
  length_m: "",
  width_m: "",
  height_m: "",
  weight_kg: "",
  max_stack_weight_kg: "",
  stackable: true,
  rotatable: true,
  fragile: false,
};

export default function Products({ token, onCountChange }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  async function loadProducts() {
    try {
      const response = await fetch(`${API_URL}/products`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("No fue posible cargar los productos");
      }

      const data = await response.json();
      setProducts(data);
      onCountChange?.(data.length);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadProducts();
  }, [token]);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function startEditing(product) {
    setEditingId(product.id);
    setForm({
      sku: product.sku || "",
      name: product.name || "",
      length_m: String(product.length_m ?? ""),
      width_m: String(product.width_m ?? ""),
      height_m: String(product.height_m ?? ""),
      weight_kg: String(product.weight_kg ?? ""),
max_stack_weight_kg: String(
  product.max_stack_weight_kg ?? ""
),
stackable: Boolean(product.stackable),
      rotatable: Boolean(product.rotatable),
      fragile: Boolean(product.fragile),
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(initialForm);
    setMessage("");
  }

  async function updateProduct(productId, payload) {
    let response = await fetch(`${API_URL}/products/${productId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 405) {
      response = await fetch(`${API_URL}/products/${productId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
    }

    return response;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const payload = {
      ...form,
      length_m: Number(form.length_m),
      width_m: Number(form.width_m),
      height_m: Number(form.height_m),
      weight_kg: Number(form.weight_kg),
      max_stack_weight_kg:
  form.max_stack_weight_kg === ""
    ? null
    : Number(
        form.max_stack_weight_kg
      ),
    };

    try {
      const response = editingId
        ? await updateProduct(editingId, payload)
        : await fetch(`${API_URL}/products`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : editingId
              ? "No fue posible actualizar el producto"
              : "No fue posible registrar el producto";

        throw new Error(detail);
      }

      setForm(initialForm);
      setEditingId(null);
      setMessage(
        editingId
          ? "Producto actualizado correctamente."
          : "Producto registrado correctamente."
      );
      await loadProducts();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteProduct(productId) {
    const confirmed = window.confirm(
      "¿Seguro que deseas eliminar este producto?"
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`${API_URL}/products/${productId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("No fue posible eliminar el producto");
      }

      if (editingId === productId) {
        cancelEditing();
      }

      await loadProducts();
      setMessage("Producto eliminado correctamente.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="module-page">
      <section className="vehicle-layout">
        <form className="form-card" onSubmit={handleSubmit}>
          <h2>{editingId ? "Editar producto" : "Nuevo producto"}</h2>

          <label htmlFor="sku">Código o SKU</label>
          <input
            id="sku"
            name="sku"
            value={form.sku}
            onChange={handleChange}
            placeholder="Ejemplo: PROD-001"
            required
          />

          <label htmlFor="name">Nombre</label>
          <input
            id="name"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Ejemplo: Caja de repuestos"
            required
          />

          <div className="dimensions-grid">
            <div>
              <label htmlFor="length_m">Largo (m)</label>
              <input
                id="length_m"
                name="length_m"
                type="number"
                step="0.01"
                min="0.01"
                value={form.length_m}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label htmlFor="width_m">Ancho (m)</label>
              <input
                id="width_m"
                name="width_m"
                type="number"
                step="0.01"
                min="0.01"
                value={form.width_m}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label htmlFor="height_m">Alto (m)</label>
              <input
                id="height_m"
                name="height_m"
                type="number"
                step="0.01"
                min="0.01"
                value={form.height_m}
                onChange={handleChange}
                required
/>
                <label htmlFor="max_stack_weight_kg">
  Peso máximo soportado al apilar (kg)
</label>

<input
  id="max_stack_weight_kg"
  name="max_stack_weight_kg"
  type="number"
  step="0.01"
  min="0"
  value={form.max_stack_weight_kg}
  onChange={handleChange}
  placeholder="Opcional"
              />
            </div>
          </div>

          <label htmlFor="weight_kg">Peso unitario (kg)</label>
          <input
            id="weight_kg"
            name="weight_kg"
            type="number"
            step="0.01"
            min="0.01"
            value={form.weight_kg}
            onChange={handleChange}
            required
          />

          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                name="stackable"
                checked={form.stackable}
                onChange={handleChange}
              />
              Apilable
            </label>

            <label>
              <input
                type="checkbox"
                name="rotatable"
                checked={form.rotatable}
                onChange={handleChange}
              />
              Permite rotación
            </label>

            <label>
              <input
                type="checkbox"
                name="fragile"
                checked={form.fragile}
                onChange={handleChange}
              />
              Frágil
            </label>
          </div>

          <button type="submit" disabled={loading}>
            {loading
              ? "Guardando..."
              : editingId
                ? "Guardar cambios"
                : "Registrar producto"}
          </button>

          {editingId && (
            <button
              type="button"
              className="secondary-action"
              onClick={cancelEditing}
              disabled={loading}
              style={{ marginTop: 8 }}
            >
              Cancelar edición
            </button>
          )}

          {message && <p className="form-message">{message}</p>}
        </form>

        <section className="table-card">
          <div className="table-heading">
            <h2>Productos registrados</h2>
            <span>{products.length} productos</span>
          </div>

          {products.length === 0 ? (
            <div className="empty-state">
              <span>📋</span>
              <h3>No hay productos registrados</h3>
              <p>Completa el formulario para registrar el primero.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Producto</th>
                    <th>Dimensiones</th>
                    <th>Volumen</th>
                    <th>Peso</th>
                    <th>Características</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {products.map((product) => {
                    const volume =
                      product.length_m *
                      product.width_m *
                      product.height_m;

                    return (
                      <tr key={product.id}>
                        <td>{product.sku}</td>
                        <td>{product.name}</td>
                        <td>
                          {product.length_m} × {product.width_m} ×{" "}
                          {product.height_m} m
                        </td>
                        <td>{volume.toFixed(3)} m³</td>
                        <td>{product.weight_kg.toLocaleString()} kg</td>
                        <td>
                          {product.stackable ? "Apilable" : "No apilable"}
                          {product.rotatable ? " · Rotable" : " · No rotable"}
                          {product.fragile ? " · Frágil" : ""}
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="edit-button"
                              onClick={() => startEditing(product)}
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              className="delete-button"
                              onClick={() => deleteProduct(product.id)}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
