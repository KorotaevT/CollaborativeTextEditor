package ru.cs.korotaev.CollaborativeTextEditor.dto

import ru.cs.korotaev.CollaborativeTextEditor.model.User

class AuthenticationResponse(val token: String, val user: User)
