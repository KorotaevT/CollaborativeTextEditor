package ru.cs.korotaev.CollaborativeTextEditor.repository

import org.springframework.data.jpa.repository.JpaRepository
import ru.cs.korotaev.CollaborativeTextEditor.model.Role

interface RoleRepository : JpaRepository<Role, Long> {

    fun findByName(name: String): Role?

}