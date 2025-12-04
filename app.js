// app.js
import { supabase } from "./supabase.js";

let headId = null;
let tailId = null;
let userId = null;

// --- HTML Elements ---
const listaTareas = document.getElementById("listaTareas");
const inputTarea = document.getElementById("inputTarea");
const btnAgregarInicio = document.getElementById("btnAgregarInicio");
const btnAgregarFinal = document.getElementById("btnAgregarFinal");

// --- Auth UI ---
const authContainer = document.createElement("div");
authContainer.innerHTML = `
    <div id="authStatus" style="text-align: center; margin: 10px 0;">
        <button id="btnLogin">Iniciar sesión</button>
        <button id="btnLogout" style="display:none;">Cerrar sesión</button>
    </div>
`;
document.body.insertBefore(authContainer, document.querySelector("h1").nextElementSibling);

const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const authStatus = document.getElementById("authStatus");

// --- Clases (igual que antes) ---
class Nodo {
    constructor(id, titulo, estatus = "pendiente") {
        this.id = id;
        this.titulo = titulo;
        this.estatus = estatus;
        this.next = null;
        this.prev = null;
    }
}

class ListaDobleEnMemoria {
    constructor() {
        this.nodos = new Map();
        this.head = null;
        this.tail = null;
    }

    agregarAlInicio(id, titulo, estatus = "pendiente") {
        const nodo = new Nodo(id, titulo, estatus);
        if (!this.head) {
            this.head = nodo;
            this.tail = nodo;
        } else {
            nodo.next = this.head;
            this.head.prev = nodo;
            this.head = nodo;
        }
        this.nodos.set(id, nodo);
    }

    agregarAlFinal(id, titulo, estatus = "pendiente") {
        const nodo = new Nodo(id, titulo, estatus);
        if (!this.tail) {
            this.head = nodo;
            this.tail = nodo;
        } else {
            nodo.prev = this.tail;
            this.tail.next = nodo;
            this.tail = nodo;
        }
        this.nodos.set(id, nodo);
    }

    eliminar(id) {
        const nodo = this.nodos.get(id);
        if (!nodo) return;

        if (nodo.prev) nodo.prev.next = nodo.next;
        else this.head = nodo.next;

        if (nodo.next) nodo.next.prev = nodo.prev;
        else this.tail = nodo.prev;

        this.nodos.delete(id);
    }

    toArray() {
        const arr = [];
        let actual = this.head;
        while (actual) {
            arr.push({
                id: actual.id,
                titulo: actual.titulo,
                estatus: actual.estatus
            });
            actual = actual.next;
        }
        return arr;
    }
}

const listaEnMemoria = new ListaDobleEnMemoria();

// --- Auth Functions ---
async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        userId = user.id;
        btnLogin.style.display = "none";
        btnLogout.style.display = "inline-block";
        authStatus.innerHTML = `<p>👤 Sesión iniciada: ${user.email}</p>`;
        cargarLista();
    } else {
        userId = null;
        btnLogin.style.display = "inline-block";
        btnLogout.style.display = "none";
        authStatus.innerHTML = "<p>🔒 Inicia sesión para gestionar tus tareas</p>";
        listaEnMemoria.head = null;
        listaEnMemoria.tail = null;
        listaEnMemoria.nodos.clear();
        actualizarLista();
    }
}

btnLogin.onclick = () => {
    // Abre el popup de login de Supabase
    supabase.auth.signInWithOAuth({
        provider: 'github', // o 'google', o usa email con UI personalizada
        options: {
            redirectTo: window.location.origin // vuelve a tu app
        }
    });
};

btnLogout.onclick = async () => {
    await supabase.auth.signOut();
    checkUser();
};

// --- Cargar tareas del usuario actual ---
async function cargarLista() {
    if (!userId) return;

    const { data, error } = await supabase
        .from("tasks")
        .select("id, titulo, estatus, id_anterior, id_siguiente")
        .eq("user_id", userId); // 🔑 Filtrar por usuario

    if (error) {
        console.error("Error al cargar tareas:", error);
        return;
    }

    const tareasMap = new Map();
    data.forEach(t => tareasMap.set(t.id, t));

    const headTarea = data.find(t => t.id_anterior === null);
    if (!headTarea) {
        listaEnMemoria.head = null;
        listaEnMemoria.tail = null;
        listaEnMemoria.nodos.clear();
        headId = null;
        tailId = null;
        actualizarLista();
        return;
    }

    listaEnMemoria.nodos.clear();
    let actualId = headTarea.id;
    let anteriorNodo = null;

    while (actualId) {
        const tarea = tareasMap.get(actualId);
        if (!tarea) break;

        const nodo = new Nodo(tarea.id, tarea.titulo, tarea.estatus);
        listaEnMemoria.nodos.set(tarea.id, nodo);

        if (anteriorNodo) {
            anteriorNodo.next = nodo;
            nodo.prev = anteriorNodo;
        } else {
            listaEnMemoria.head = nodo;
        }

        anteriorNodo = nodo;
        actualId = tarea.id_siguiente;
    }

    listaEnMemoria.tail = anteriorNodo;
    headId = listaEnMemoria.head?.id || null;
    tailId = listaEnMemoria.tail?.id || null;

    actualizarLista();
}

// --- Insertar tareas con user_id ---
async function insertarAlInicio(titulo) {
    if (!userId) { alert("Inicia sesión primero"); return; }
    let nuevaTarea;

    if (headId === null) {
        const { data, error } = await supabase
            .from("tasks")
            .insert({ 
                titulo,
                estatus: "pendiente",
                user_id: userId  // 🔑 Asignar al usuario
            })
            .select()
            .single();

        if (error) { console.error(error); return; }
        nuevaTarea = data;
        headId = nuevaTarea.id;
        tailId = nuevaTarea.id;
    } else {
        const { data, error } = await supabase
            .from("tasks")
            .insert({
                titulo,
                estatus: "pendiente",
                user_id: userId,  // 🔑
                id_siguiente: headId,
                id_anterior: null
            })
            .select()
            .single();

        if (error) { console.error(error); return; }
        nuevaTarea = data;

        const { error: updateError } = await supabase
            .from("tasks")
            .update({ id_anterior: nuevaTarea.id })
            .eq("id", headId);

        if (updateError) { console.error(updateError); return; }

        headId = nuevaTarea.id;
    }

    listaEnMemoria.agregarAlInicio(nuevaTarea.id, nuevaTarea.titulo, nuevaTarea.estatus);
    actualizarLista();
}

async function insertarAlFinal(titulo) {
    if (!userId) { alert("Inicia sesión primero"); return; }
    let nuevaTarea;

    if (tailId === null) {
        const { data, error } = await supabase
            .from("tasks")
            .insert({ 
                titulo,
                estatus: "pendiente",
                user_id: userId  // 🔑
            })
            .select()
            .single();

        if (error) { console.error(error); return; }
        nuevaTarea = data;
        headId = nuevaTarea.id;
        tailId = nuevaTarea.id;
    } else {
        const { data, error } = await supabase
            .from("tasks")
            .insert({
                titulo,
                estatus: "pendiente",
                user_id: userId,  // 🔑
                id_anterior: tailId,
                id_siguiente: null
            })
            .select()
            .single();

        if (error) { console.error(error); return; }
        nuevaTarea = data;

        const { error: updateError } = await supabase
            .from("tasks")
            .update({ id_siguiente: nuevaTarea.id })
            .eq("id", tailId);

        if (updateError) { console.error(updateError); return; }

        tailId = nuevaTarea.id;
    }

    listaEnMemoria.agregarAlFinal(nuevaTarea.id, nuevaTarea.titulo, nuevaTarea.estatus);
    actualizarLista();
}

// --- Eliminar tarea ---
async function eliminarTarea(id) {
    if (!userId) return;

    const tarea = listaEnMemoria.nodos.get(id);
    if (!tarea) return;

    const anteriorId = tarea.prev?.id || null;
    const siguienteId = tarea.next?.id || null;

    if (anteriorId) {
        await supabase
            .from("tasks")
            .update({ id_siguiente: siguienteId })
            .eq("id", anteriorId);
    } else {
        headId = siguienteId;
    }

    if (siguienteId) {
        await supabase
            .from("tasks")
            .update({ id_anterior: anteriorId })
            .eq("id", siguienteId);
    } else {
        tailId = anteriorId;
    }

    await supabase
        .from("tasks")
        .delete()
        .eq("id", id);

    listaEnMemoria.eliminar(id);
    actualizarLista();
}

// --- Actualizar UI ---
function actualizarLista() {
    listaTareas.innerHTML = "";
    if (!userId) {
        listaTareas.innerHTML = "<li>🔒 Inicia sesión para ver tus tareas</li>";
        return;
    }

    listaEnMemoria.toArray().forEach(t => {
        const li = document.createElement("li");
        
        const spanTitulo = document.createElement("span");
        spanTitulo.textContent = t.titulo;
        spanTitulo.style.marginRight = "10px";
        li.appendChild(spanTitulo);

        const selectEstatus = document.createElement("select");
        ["pendiente", "en_progreso", "terminada"].forEach(estado => {
            const option = document.createElement("option");
            option.value = estado;
            option.textContent = 
                estado === "pendiente" ? "⏳ Pendiente" :
                estado === "en_progreso" ? "🔄 En progreso" :
                "✅ Terminada";
            if (t.estatus === estado) option.selected = true;
            selectEstatus.appendChild(option);
        });

        selectEstatus.onchange = async () => {
            const nuevoEstatus = selectEstatus.value;
            try {
                const { error } = await supabase
                    .from("tasks")
                    .update({ estatus: nuevoEstatus })
                    .eq("id", t.id)
                    .eq("user_id", userId); // 🔒 seguridad extra
                if (error) throw error;
                const nodo = listaEnMemoria.nodos.get(t.id);
                if (nodo) nodo.estatus = nuevoEstatus;
            } catch (err) {
                console.error("Error:", err);
                alert("No se pudo actualizar");
            }
        };

        li.appendChild(selectEstatus);

        const btnEliminar = document.createElement("span");
        btnEliminar.textContent = "❌";
        btnEliminar.classList.add("eliminar");
        btnEliminar.onclick = () => eliminarTarea(t.id);
        li.appendChild(btnEliminar);

        listaTareas.appendChild(li);
    });
}

// --- Eventos ---
btnAgregarInicio.onclick = () => {
    const titulo = inputTarea.value.trim();
    if (!titulo) return;
    insertarAlInicio(titulo);
    inputTarea.value = "";
};

btnAgregarFinal.onclick = () => {
    const titulo = inputTarea.value.trim();
    if (!titulo) return;
    insertarAlFinal(titulo);
    inputTarea.value = "";
};

// --- Iniciar ---
checkUser();

// Escuchar cambios de sesión (ej: al volver de login)
supabase.auth.onAuthStateChange((event, session) => {
    checkUser();
});
