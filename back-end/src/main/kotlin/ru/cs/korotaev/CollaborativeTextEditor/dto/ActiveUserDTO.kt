package ru.cs.korotaev.CollaborativeTextEditor.dto

data class ActiveUserDTO(
    val documentId: Long,
    val userId: Long,
    val action: String
)
