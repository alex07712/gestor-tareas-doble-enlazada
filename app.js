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
authContainer.id = "authContainer";
authContainer.innerHTML = `
    <div id="authForm" style="max-width: 400px; margin: 20px auto; padding: 20px; background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h3 style="text-align: center;">🔐 Iniciar sesión / Registrarse</h3>
        <input type="email" id="email" placeholder="Email" style="width:100%; padding:10px; margin:8px 0; border:1px solid #ddd; border-radius:4px;">
        <input type="password" id="password" placeholder="Contraseña (mín. 6 caracteres)" style="width:100%; padding:10px; margin:8px 0; border:1px solid #ddd; border-radius:4px;">
        <button id="btnSignIn" style="width:100%; padding:10px; margin:8px 0; background:#4CAF50; color:white; border:none; border-radius:4px; cursor:pointer;">Iniciar sesión</button>
        <button id="btnSignUp" style="width:100%; padding:10px; margin:8px 0; background:#2196F3; color:white; border:none; border-radius:4px; cursor:pointer;">Registrarse</button>
        <button id="btnLogout" style="width:100%; padding:10px; margin:8px 0; background:#f44336; color:white; border:none; border-radius:4px; cursor:pointer; display:none;">Cerrar sesión</button>
        <p id="authMessage" style="margin-top:10px; text-align:center; min-height:20px;"></p>
    </div>
`;
document.body.insertBefore(authContainer, document.querySelector("h1").nextElementSibling);

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const btnSignIn = document.getElementById("btnSignIn");
const btnSignUp = document.getElementById("btnSignUp");
const btnLogout = document.getElementById("btnLogout");
const authMessage = document.getElementById("authMessage");

// --- Clases ---
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
async function showMessage(msg, isError = false) {
    authMessage.textContent = msg;
    authMessage.style.color = isError ? "red" : "green";
}

async function checkUser() {
    const {  { user } } = await supabase.auth.getUser();
    if (user) {
        userId = user.id;
        document.getElementById("authForm").style.display = "none";
        btnLogout.style.display = "block";
        authMessage.textContent = `👤 Sesión iniciada: ${user.email}`;
        cargarLista();
    } else {
        userId = null;
        document.getElementById("authForm").style.display = "block";
        btnLogout.style.display = "none";
        authMessage.textContent = "";
        listaEnMemoria.head = null;
        listaEnMemoria.tail = null;
        listaEnMemoria.nodos.clear();
        actualizarLista();
    }
}

btnSignUp.onclick = async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) return showMessage("Completa todos los campos", true);
    if (password.length < 6) return showMessage("La contraseña debe tener al menos 6 caracteres", true);

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: window.location.origin
        }
    });

    if (error) {
        showMessage(error.message, true);
    } else if (data.user) {
        showMessage("¡Registro exitoso! Revisa tu email para confirmar tu cuenta.", false);
    }
};

btnSignIn.onclick = async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) return showMessage("Completa todos los campos", true);

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        showMessage(error.message, true);
    } else if (data.user) {
        showMessage("Inicio de sesión exitoso", false);
        checkUser();
    }
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
        .eq("user_id", userId);

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

// --- Insertar al inicio ---
async function insertarAlInicio(titulo) {
    if (!userId) { showMessage("Inicia sesión primero", true); return; }
    let nuevaTarea;

    if (headId === null) {
        const { data, error } = await supabase
            .from("tasks")
            .insert({ 
                titulo,
                estatus: "pendiente",
                user_id: userId
            })
            .select()
            .single();

        if (error) { console.error(error); showMessage("Error al guardar", true); return; }
        nuevaTarea = data;
        headId = nuevaTarea.id;
        tailId = nuevaTarea.id;
    } else {
        const { data, error } = await supabase
            .from("tasks")
            .insert({
                titulo,
                estatus: "pendiente",
                user_id: userId,
                id_siguiente: headId,
                id_anterior: null
            })
            .select()
            .single();

        if (error) { console.error(error); showMessage("Error al guardar", true); return; }
        nuevaTarea = data;

        const { error: updateError } = await supabase
            .from("tasks")
            .update({ id_anterior: nuevaTarea.id })
            .eq("id", headId);

        if (updateError) { console.error(updateError); showMessage("Error al enlazar", true); return; }

        headId = nuevaTarea.id;
    }

    listaEnMemoria.agregarAlInicio(nuevaTarea.id, nuevaTarea.titulo, nuevaTarea.estatus);
    actualizarLista();
}

// --- Insertar al final ---
async function insertarAlFinal(titulo) {
    if (!userId) { showMessage("Inicia sesión primero", true); return; }
    let nuevaTarea;

    if (tailId === null) {
        const { data, error } = await supabase
            .from("tasks")
            .insert({ 
                titulo,
                estatus: "pendiente",
                user_id: userId
            })
            .select()
            .single();

        if (error) { console.error(error); showMessage("Error al guardar", true); return; }
        nuevaTarea = data;
        headId = nuevaTarea.id;
        tailId = nuevaTarea.id;
    } else {
        const { data, error } = await supabase
            .from("tasks")
            .insert({
                titulo,
                estatus: "pendiente",
                user_id: userId,
                id_anterior: tailId,
                id_siguiente: null
            })
            .select()
            .single();

        if (error) { console.error(error); showMessage("Error al guardar", true); return; }
        nuevaTarea = data;

        const { error: updateError } = await supabase
            .from("tasks")
            .update({ id_siguiente: nuevaTarea.id })
            .eq("id", tailId);

        if (updateError) { console.error(updateError); showMessage("Error al enlazar", true); return; }

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
        listaTareas.innerHTML = "<li style='text-align:center; color:#888;'>🔒 Inicia sesión para ver y gestionar tus tareas</li>";
        return;
    }

    listaEnMemoria.toArray().forEach(t => {
        const li = document.createElement("li");
        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.style.alignItems = "center";
        li.style.padding = "10px";
        li.style.background = "#f9f9f9";
        li.style.borderRadius = "4px";
        li.style.marginBottom = "8px";

        const spanTitulo = document.createElement("span");
        spanTitulo.textContent = t.titulo;
        spanTitulo.style.flex = "1";
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
                    .eq("user_id", userId);
                if (error) throw error;
                const nodo = listaEnMemoria.nodos.get(t.id);
                if (nodo) nodo.estatus = nuevoEstatus;
            } catch (err) {
                console.error("Error:", err);
                showMessage("No se pudo actualizar el estado", true);
            }
        };

        li.appendChild(selectEstatus);

        const btnEliminar = document.createElement("span");
        btnEliminar.textContent = " ❌";
        btnEliminar.style.color = "red";
        btnEliminar.style.cursor = "pointer";
        btnEliminar.style.marginLeft = "10px";
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

// Escuchar cambios de sesión
supabase.auth.onAuthStateChange((event, session) => {
    checkUser();
});
