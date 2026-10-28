import React, { useEffect, useMemo, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

const initialForm = {
  name: "",
  plate: "",
  vehicle_type: "truck",

  internal_length_m: "",
  internal_width_m: "",
  internal_height_m: "",

  tare_weight_kg: "",
  max_gross_weight_kg: "",
  max_payload_kg: "",

  // Configuración de ejes
  front_axle_position_m: "",
  rear_axle_position_m: "",

  front_axle_max_kg: "",
  rear_axle_max_kg: "",

  // Peso soportado por cada eje con el vehículo vacío
  front_axle_tare_kg: "",
  rear_axle_tare_kg: "",
};

function optionalNumber(value) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

export default function Vehicles({
  token,
  onCountChange,
}) {
  const [vehicles, setVehicles] =
    useState([]);

  const [form, setForm] =
    useState(initialForm);

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [editingId, setEditingId] =
    useState(null);

  const calculatedPayload =
    useMemo(() => {
      const tare =
        Number(
          form.tare_weight_kg || 0
        );

      const gross =
        Number(
          form.max_gross_weight_kg ||
            0
        );

      if (
        tare >= 0 &&
        gross > 0 &&
        gross >= tare
      ) {
        return gross - tare;
      }

      return 0;
    }, [
      form.tare_weight_kg,
      form.max_gross_weight_kg,
    ]);

  const axleTareSum =
    useMemo(() => {
      const front =
        Number(
          form.front_axle_tare_kg ||
            0
        );

      const rear =
        Number(
          form.rear_axle_tare_kg ||
            0
        );

      return front + rear;
    }, [
      form.front_axle_tare_kg,
      form.rear_axle_tare_kg,
    ]);

  const axleTareDifference =
    useMemo(() => {
      const tare =
        Number(
          form.tare_weight_kg || 0
        );

      if (
        tare <= 0 ||
        axleTareSum <= 0
      ) {
        return 0;
      }

      return Math.abs(
        tare - axleTareSum
      );
    }, [
      form.tare_weight_kg,
      axleTareSum,
    ]);

  async function loadVehicles() {
    try {
      const response =
        await fetch(
          `${API_URL}/vehicles`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      if (!response.ok) {
        throw new Error(
          "No fue posible cargar los vehículos"
        );
      }

      const data =
        await response.json();

      setVehicles(data);

      onCountChange?.(
        data.length
      );
    } catch (error) {
      setMessage(
        error.message
      );
    }
  }

  useEffect(() => {
    loadVehicles();
  }, [token]);

  function handleChange(event) {
    const {
      name,
      value,
    } = event.target;

    setForm((current) => {
      const next = {
        ...current,
        [name]: value,
      };

      if (
        name ===
          "tare_weight_kg" ||
        name ===
          "max_gross_weight_kg"
      ) {
        const tare =
          Number(
            name ===
              "tare_weight_kg"
              ? value
              : next.tare_weight_kg ||
                  0
          );

        const gross =
          Number(
            name ===
              "max_gross_weight_kg"
              ? value
              : next.max_gross_weight_kg ||
                  0
          );

        next.max_payload_kg =
          tare >= 0 &&
          gross > 0 &&
          gross >= tare
            ? String(
                gross - tare
              )
            : "";
      }

      return next;
    });
  }

  function startEditing(vehicle) {
    setEditingId(
      vehicle.id
    );

    setMessage("");

    setForm({
      name:
        vehicle.name || "",

      plate:
        vehicle.plate || "",

      vehicle_type:
        vehicle.vehicle_type ||
        "truck",

      internal_length_m:
        String(
          vehicle.internal_length_m ??
            ""
        ),

      internal_width_m:
        String(
          vehicle.internal_width_m ??
            ""
        ),

      internal_height_m:
        String(
          vehicle.internal_height_m ??
            ""
        ),

      tare_weight_kg:
        String(
          vehicle.tare_weight_kg ??
            0
        ),

      max_gross_weight_kg:
        String(
          vehicle.max_gross_weight_kg ??
            0
        ),

      max_payload_kg:
        String(
          vehicle.max_payload_kg ??
            0
        ),

      front_axle_position_m:
        String(
          vehicle.front_axle_position_m ??
            ""
        ),

      rear_axle_position_m:
        String(
          vehicle.rear_axle_position_m ??
            ""
        ),

      front_axle_max_kg:
        String(
          vehicle.front_axle_max_kg ??
            ""
        ),

      rear_axle_max_kg:
        String(
          vehicle.rear_axle_max_kg ??
            ""
        ),

      front_axle_tare_kg:
        String(
          vehicle.front_axle_tare_kg ??
            ""
        ),

      rear_axle_tare_kg:
        String(
          vehicle.rear_axle_tare_kg ??
            ""
        ),
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(initialForm);
    setMessage("");
  }

  async function updateVehicle(
    vehicleId,
    payload
  ) {
    let response =
      await fetch(
        `${API_URL}/vehicles/${vehicleId}`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body:
            JSON.stringify(
              payload
            ),
        }
      );

    if (
      response.status === 405
    ) {
      response =
        await fetch(
          `${API_URL}/vehicles/${vehicleId}`,
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify(
                payload
              ),
          }
        );
    }

    return response;
  }

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    const tareWeight =
      Number(
        form.tare_weight_kg
      );

    const maxGrossWeight =
      Number(
        form.max_gross_weight_kg
      );

    const maxPayload =
      Number(
        form.max_payload_kg
      );

    const frontAxlePosition =
      optionalNumber(
        form.front_axle_position_m
      );

    const rearAxlePosition =
      optionalNumber(
        form.rear_axle_position_m
      );

    const frontAxleMax =
      optionalNumber(
        form.front_axle_max_kg
      );

    const rearAxleMax =
      optionalNumber(
        form.rear_axle_max_kg
      );

    const frontAxleTare =
      optionalNumber(
        form.front_axle_tare_kg
      );

    const rearAxleTare =
      optionalNumber(
        form.rear_axle_tare_kg
      );

    if (tareWeight < 0) {
      setMessage(
        "La tara no puede ser negativa."
      );

      setLoading(false);
      return;
    }

    if (
      maxGrossWeight <= 0
    ) {
      setMessage(
        "Ingresá el peso bruto máximo."
      );

      setLoading(false);
      return;
    }

    if (
      maxGrossWeight <
      tareWeight
    ) {
      setMessage(
        "El peso bruto máximo no puede ser menor que la tara."
      );

      setLoading(false);
      return;
    }

    if (
      frontAxlePosition !==
        null &&
      rearAxlePosition !==
        null &&
      rearAxlePosition <=
        frontAxlePosition
    ) {
      setMessage(
        "La posición del eje trasero debe ser mayor que la posición del eje delantero."
      );

      setLoading(false);
      return;
    }

    if (
      frontAxleTare !==
        null &&
      frontAxleTare < 0
    ) {
      setMessage(
        "La tara del eje delantero no puede ser negativa."
      );

      setLoading(false);
      return;
    }

    if (
      rearAxleTare !==
        null &&
      rearAxleTare < 0
    ) {
      setMessage(
        "La tara del eje trasero no puede ser negativa."
      );

      setLoading(false);
      return;
    }

    const axleTareConfigured =
      frontAxleTare !==
        null ||
      rearAxleTare !==
        null;

    if (
      axleTareConfigured &&
      (
        frontAxleTare ===
          null ||
        rearAxleTare ===
          null
      )
    ) {
      setMessage(
        "Si cargás la tara por eje, completá tanto el eje delantero como el trasero."
      );

      setLoading(false);
      return;
    }

    if (
      frontAxleTare !==
        null &&
      rearAxleTare !==
        null &&
      tareWeight > 0
    ) {
      const tareDifference =
        Math.abs(
          frontAxleTare +
            rearAxleTare -
            tareWeight
        );

      if (
        tareDifference > 10
      ) {
        setMessage(
          `La suma de las taras por eje (${(
            frontAxleTare +
            rearAxleTare
          ).toLocaleString()} kg) debe coincidir aproximadamente con la tara total del vehículo (${tareWeight.toLocaleString()} kg).`
        );

        setLoading(false);
        return;
      }
    }

    const payload = {
      name:
        form.name,

      plate:
        form.plate,

      vehicle_type:
        form.vehicle_type,

      internal_length_m:
        Number(
          form.internal_length_m
        ),

      internal_width_m:
        Number(
          form.internal_width_m
        ),

      internal_height_m:
        Number(
          form.internal_height_m
        ),

      tare_weight_kg:
        tareWeight,

      max_gross_weight_kg:
        maxGrossWeight,

      max_payload_kg:
        maxPayload,

      front_axle_position_m:
        frontAxlePosition,

      rear_axle_position_m:
        rearAxlePosition,

      front_axle_max_kg:
        frontAxleMax,

      rear_axle_max_kg:
        rearAxleMax,

      front_axle_tare_kg:
        frontAxleTare,

      rear_axle_tare_kg:
        rearAxleTare,
    };

    try {
      const response =
        editingId
          ? await updateVehicle(
              editingId,
              payload
            )
          : await fetch(
              `${API_URL}/vehicles`,
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",

                  Authorization:
                    `Bearer ${token}`,
                },

                body:
                  JSON.stringify(
                    payload
                  ),
              }
            );

      const data =
        await response.json();

      if (!response.ok) {
        const detail =
          typeof data.detail ===
          "string"
            ? data.detail
            : "No fue posible registrar el vehículo";

        throw new Error(
          detail
        );
      }

      setForm(initialForm);

      setEditingId(null);

      setMessage(
        editingId
          ? "Vehículo actualizado correctamente."
          : "Vehículo registrado correctamente."
      );

      await loadVehicles();
    } catch (error) {
      setMessage(
        error.message
      );
    } finally {
      setLoading(false);
    }
  }

  async function deleteVehicle(
    vehicleId
  ) {
    const confirmed =
      window.confirm(
        "¿Seguro que deseas eliminar este vehículo?"
      );

    if (!confirmed) {
      return;
    }

    try {
      const response =
        await fetch(
          `${API_URL}/vehicles/${vehicleId}`,
          {
            method:
              "DELETE",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      if (!response.ok) {
        throw new Error(
          "No fue posible eliminar el vehículo"
        );
      }

      await loadVehicles();

      setMessage(
        "Vehículo eliminado correctamente."
      );
    } catch (error) {
      setMessage(
        error.message
      );
    }
  }

  return (
    <div className="module-page">
      <div className="module-heading">
        <div>
          <h1>
            Vehículos
          </h1>

          <p>
            Administra los camiones y unidades de transporte.
          </p>
        </div>
      </div>

      <section className="vehicle-layout">
        <form
          className="form-card"
          onSubmit={
            handleSubmit
          }
        >
          <h2>
            {editingId
              ? "Editar vehículo"
              : "Nuevo vehículo"}
          </h2>

          <label htmlFor="name">
            Nombre o identificación
          </label>

          <input
            id="name"
            name="name"
            value={
              form.name
            }
            onChange={
              handleChange
            }
            placeholder="Ejemplo: Camión 01"
            required
          />

          <label htmlFor="plate">
            Matrícula
          </label>

          <input
            id="plate"
            name="plate"
            value={
              form.plate
            }
            onChange={
              handleChange
            }
            placeholder="Ejemplo: ABC 1234"
            required
          />

          <label htmlFor="vehicle_type">
            Tipo de vehículo
          </label>

          <select
            id="vehicle_type"
            name="vehicle_type"
            value={
              form.vehicle_type
            }
            onChange={
              handleChange
            }
          >
            <option value="truck">
              Camión
            </option>

            <option value="trailer">
              Semirremolque
            </option>

            <option value="van">
              Furgón
            </option>

            <option value="pickup">
              Camioneta
            </option>
          </select>

          <div className="dimensions-grid">
            <div>
              <label htmlFor="internal_length_m">
                Largo interno (m)
              </label>

              <input
                id="internal_length_m"
                name="internal_length_m"
                type="number"
                step="0.01"
                min="0.01"
                value={
                  form.internal_length_m
                }
                onChange={
                  handleChange
                }
                required
              />
            </div>

            <div>
              <label htmlFor="internal_width_m">
                Ancho interno (m)
              </label>

              <input
                id="internal_width_m"
                name="internal_width_m"
                type="number"
                step="0.01"
                min="0.01"
                value={
                  form.internal_width_m
                }
                onChange={
                  handleChange
                }
                required
              />
            </div>

            <div>
              <label htmlFor="internal_height_m">
                Alto interno (m)
              </label>

              <input
                id="internal_height_m"
                name="internal_height_m"
                type="number"
                step="0.01"
                min="0.01"
                value={
                  form.internal_height_m
                }
                onChange={
                  handleChange
                }
                required
              />
            </div>
          </div>

          <label htmlFor="tare_weight_kg">
            Tara / peso propio (kg)
          </label>

          <input
            id="tare_weight_kg"
            name="tare_weight_kg"
            type="number"
            step="0.01"
            min="0"
            value={
              form.tare_weight_kg
            }
            onChange={
              handleChange
            }
            placeholder="Ejemplo: 8500"
            required
          />

          <label htmlFor="max_gross_weight_kg">
            Peso bruto máximo (kg)
          </label>

          <input
            id="max_gross_weight_kg"
            name="max_gross_weight_kg"
            type="number"
            step="0.01"
            min="0.01"
            value={
              form.max_gross_weight_kg
            }
            onChange={
              handleChange
            }
            placeholder="Ejemplo: 40000"
            required
          />

          <label htmlFor="max_payload_kg">
            Carga útil máxima (kg)
          </label>

          <input
            id="max_payload_kg"
            name="max_payload_kg"
            type="number"
            step="0.01"
            min="0"
            value={
              form.max_payload_kg
            }
            readOnly
          />

          <small
            style={{
              display:
                "block",
              marginTop:
                -6,
              marginBottom:
                10,
            }}
          >
            Cálculo automático: peso bruto máximo − tara
            {calculatedPayload >
            0
              ? ` = ${calculatedPayload.toLocaleString()} kg`
              : ""}
          </small>

          <div
            style={{
              marginTop: 18,
              marginBottom: 14,
              padding: 14,
              border:
                "1px solid #dbe3ee",
              borderRadius:
                10,
              background:
                "#f8fafc",
            }}
          >
            <h3
              style={{
                marginTop:
                  0,
                marginBottom:
                  6,
              }}
            >
              Configuración de ejes
            </h3>

            <p
              style={{
                marginTop:
                  0,
                marginBottom:
                  14,
                fontSize:
                  13,
                color:
                  "#64748b",
              }}
            >
              Configura la posición, el límite máximo y el peso en vacío soportado por cada eje.
            </p>

            <div className="dimensions-grid">
              <div>
                <label htmlFor="front_axle_position_m">
                  Posición eje delantero (m)
                </label>

                <input
                  id="front_axle_position_m"
                  name="front_axle_position_m"
                  type="number"
                  step="0.01"
                  min="0"
                  value={
                    form.front_axle_position_m
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Ejemplo: 1.20"
                />
              </div>

              <div>
                <label htmlFor="rear_axle_position_m">
                  Posición eje trasero (m)
                </label>

                <input
                  id="rear_axle_position_m"
                  name="rear_axle_position_m"
                  type="number"
                  step="0.01"
                  min="0"
                  value={
                    form.rear_axle_position_m
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Ejemplo: 8.50"
                />
              </div>
            </div>

            <div className="dimensions-grid">
              <div>
                <label htmlFor="front_axle_max_kg">
                  Carga máxima eje delantero (kg)
                </label>

                <input
                  id="front_axle_max_kg"
                  name="front_axle_max_kg"
                  type="number"
                  step="1"
                  min="0"
                  value={
                    form.front_axle_max_kg
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Ejemplo: 7500"
                />
              </div>

              <div>
                <label htmlFor="rear_axle_max_kg">
                  Carga máxima eje trasero (kg)
                </label>

                <input
                  id="rear_axle_max_kg"
                  name="rear_axle_max_kg"
                  type="number"
                  step="1"
                  min="0"
                  value={
                    form.rear_axle_max_kg
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Ejemplo: 18000"
                />
              </div>
            </div>

            <div
              style={{
                marginTop:
                  14,
                paddingTop:
                  14,
                borderTop:
                  "1px solid #dbe3ee",
              }}
            >
              <h4
                style={{
                  margin:
                    "0 0 6px",
                }}
              >
                Peso en vacío por eje
              </h4>

              <p
                style={{
                  margin:
                    "0 0 12px",
                  fontSize:
                    12,
                  color:
                    "#64748b",
                }}
              >
                Estos valores representan cuánto peso soporta cada eje con el vehículo vacío.
              </p>

              <div className="dimensions-grid">
                <div>
                  <label htmlFor="front_axle_tare_kg">
                    Tara eje delantero (kg)
                  </label>

                  <input
                    id="front_axle_tare_kg"
                    name="front_axle_tare_kg"
                    type="number"
                    step="1"
                    min="0"
                    value={
                      form.front_axle_tare_kg
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Ejemplo: 4000"
                  />
                </div>

                <div>
                  <label htmlFor="rear_axle_tare_kg">
                    Tara eje trasero (kg)
                  </label>

                  <input
                    id="rear_axle_tare_kg"
                    name="rear_axle_tare_kg"
                    type="number"
                    step="1"
                    min="0"
                    value={
                      form.rear_axle_tare_kg
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Ejemplo: 4500"
                  />
                </div>
              </div>

              {axleTareSum >
                0 && (
                <small
                  style={{
                    display:
                      "block",
                    marginTop:
                      8,
                    color:
                      axleTareDifference >
                      10
                        ? "#b45309"
                        : "#64748b",
                  }}
                >
                  Suma de tara por ejes:{" "}
                  <strong>
                    {axleTareSum.toLocaleString()} kg
                  </strong>

                  {Number(
                    form.tare_weight_kg ||
                      0
                  ) >
                    0 && (
                    <>
                      {" "}
                      · Tara total:{" "}
                      <strong>
                        {Number(
                          form.tare_weight_kg ||
                            0
                        ).toLocaleString()} kg
                      </strong>
                    </>
                  )}

                  {axleTareDifference >
                    10 && (
                    <>
                      {" "}
                      · ⚠️ Diferencia:{" "}
                      {axleTareDifference.toLocaleString()} kg
                    </>
                  )}
                </small>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={
              loading
            }
          >
            {loading
              ? "Guardando..."
              : editingId
                ? "Guardar cambios"
                : "Registrar vehículo"}
          </button>

          {editingId && (
            <button
              type="button"
              className="secondary-action"
              onClick={
                cancelEditing
              }
              disabled={
                loading
              }
              style={{
                marginTop:
                  8,
              }}
            >
              Cancelar edición
            </button>
          )}

          {message && (
            <p className="form-message">
              {message}
            </p>
          )}
        </form>

        <section className="table-card">
          <div className="table-heading">
            <h2>
              Vehículos registrados
            </h2>

            <span>
              {vehicles.length} unidades
            </span>
          </div>

          {vehicles.length ===
          0 ? (
            <div className="empty-state">
              <span>
                🚛
              </span>

              <h3>
                No hay vehículos registrados
              </h3>

              <p>
                Completa el formulario para registrar la primera unidad.
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>
                      Nombre
                    </th>

                    <th>
                      Matrícula
                    </th>

                    <th>
                      Tipo
                    </th>

                    <th>
                      Dimensiones
                    </th>

                    <th>
                      Tara
                    </th>

                    <th>
                      Peso bruto máx.
                    </th>

                    <th>
                      Carga útil
                    </th>

                    <th>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {vehicles.map(
                    (vehicle) => (
                      <tr
                        key={
                          vehicle.id
                        }
                      >
                        <td>
                          {
                            vehicle.name
                          }
                        </td>

                        <td>
                          {
                            vehicle.plate
                          }
                        </td>

                        <td>
                          {
                            vehicle.vehicle_type
                          }
                        </td>

                        <td>
                          {
                            vehicle.internal_length_m
                          }{" "}
                          ×{" "}
                          {
                            vehicle.internal_width_m
                          }{" "}
                          ×{" "}
                          {
                            vehicle.internal_height_m
                          }{" "}
                          m
                        </td>

                        <td>
                          {Number(
                            vehicle.tare_weight_kg ||
                              0
                          ).toLocaleString()}{" "}
                          kg
                        </td>

                        <td>
                          {Number(
                            vehicle.max_gross_weight_kg ||
                              0
                          ).toLocaleString()}{" "}
                          kg
                        </td>

                        <td>
                          {Number(
                            vehicle.max_payload_kg ||
                              0
                          ).toLocaleString()}{" "}
                          kg
                        </td>

                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="edit-button"
                              onClick={() =>
                                startEditing(
                                  vehicle
                                )
                              }
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              className="delete-button"
                              onClick={() =>
                                deleteVehicle(
                                  vehicle.id
                                )
                              }
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}